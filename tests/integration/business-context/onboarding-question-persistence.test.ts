import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { QuestionRepository } from "@/infrastructure/business-context/repository/facts/question.repository";

// ---------------------------------------------------------------------------
// B26a verification — real Supabase integration test for onboarding question
// persistence and history.
//
// Proves against live Supabase (no mocks, no in-memory repo):
//   1. createOnboardingQuestion persists and returns correct fields
//   2. getOnboardingQuestion retrieves by workspace + id
//   3. listOnboardingQuestions preserves answer/provenance after answer
//   4. Workspace isolation — cross-workspace get returns null
//
// Uses service-role client to seed workspace + business (FK targets).
// No production code edits unless RED reveals a defect.
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";

let supabase: SupabaseClient;
let repo: QuestionRepository;

const TEST_WORKSPACE = crypto.randomUUID();
const OTHER_WORKSPACE = crypto.randomUUID();
const TEST_BUSINESS = crypto.randomUUID();
const OTHER_BUSINESS = crypto.randomUUID();
const TEST_SESSION = crypto.randomUUID();
const TEST_USER = crypto.randomUUID();

beforeAll(async () => {
  if (!SUPABASE_SERVICE_KEY) return;

  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  repo = new QuestionRepository(supabase);

  // Seed workspaces (FK targets)
  await supabase
    .from("workspaces")
    .upsert(
      [
        { id: TEST_WORKSPACE, name: "Test Workspace" },
        { id: OTHER_WORKSPACE, name: "Other Workspace" },
      ],
      { onConflict: "id" },
    );

  // Seed businesses (FK target for onboarding_questions.business_id)
  await supabase
    .from("businesses")
    .upsert(
      [
        {
          id: TEST_BUSINESS,
          workspace_id: TEST_WORKSPACE,
          name: "Test Biz",
          status: "active",
        },
        {
          id: OTHER_BUSINESS,
          workspace_id: OTHER_WORKSPACE,
          name: "Other Biz",
          status: "active",
        },
      ],
      { onConflict: "id" },
    );

  // Seed onboarding session (FK target for onboarding_questions.session_id)
  await supabase.from("onboarding_sessions").upsert(
    {
      id: TEST_SESSION,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      status: "awaiting_answers",
      current_step: "questions",
      started_by: TEST_USER,
      started_at: new Date().toISOString(),
      completed_at: null,
      error: null,
    },
    { onConflict: "id" },
  );
});

afterAll(async () => {
  if (!supabase) return;
  // Workspace FK cascade deletes questions, businesses, sessions automatically
  await supabase.from("workspaces").delete().eq("id", TEST_WORKSPACE);
  await supabase.from("workspaces").delete().eq("id", OTHER_WORKSPACE);
});

// ─── Tests ────────────────────────────────────────────────────────────────

describe.skipIf(!SUPABASE_SERVICE_KEY)(
  "QuestionRepository — real Supabase onboarding question persistence",
  () => {
    it("create + get round-trips all fields", async () => {
      const created = await repo.createOnboardingQuestion({
        workspaceId: TEST_WORKSPACE,
        sessionId: TEST_SESSION,
        businessId: TEST_BUSINESS,
        factKey: "company_name",
        questionType: "text",
        question: "What is your company name?",
        options: null,
        reason: "Required for profile",
        priority: 10,
        status: "open",
        answer: null,
        answeredBy: null,
        answeredAt: null,
      });

      expect(created.ok).toBe(true);
      if (!created.ok) throw created.error;

      const q = created.data;
      expect(q.id).toBeTruthy();
      expect(q.workspaceId).toBe(TEST_WORKSPACE);
      expect(q.sessionId).toBe(TEST_SESSION);
      expect(q.businessId).toBe(TEST_BUSINESS);
      expect(q.factKey).toBe("company_name");
      expect(q.questionType).toBe("text");
      expect(q.question).toBe("What is your company name?");
      expect(q.options).toBeNull();
      expect(q.reason).toBe("Required for profile");
      expect(q.priority).toBe(10);
      expect(q.status).toBe("open");
      expect(q.answer).toBeNull();
      expect(q.answeredBy).toBeNull();
      expect(q.answeredAt).toBeNull();

      // get round-trip
      const got = await repo.getOnboardingQuestion(TEST_WORKSPACE, q.id);
      expect(got.ok).toBe(true);
      if (!got.ok) throw got.error;
      expect(got.data).not.toBeNull();
      expect(got.data!.id).toBe(q.id);
      expect(got.data!.factKey).toBe("company_name");
    });

    it("answer + list preserves answer and provenance", async () => {
      // Create an open question
      const created = await repo.createOnboardingQuestion({
        workspaceId: TEST_WORKSPACE,
        sessionId: TEST_SESSION,
        businessId: TEST_BUSINESS,
        factKey: "industry",
        questionType: "select",
        question: "What industry are you in?",
        options: ["Tech", "Retail", "Healthcare"],
        reason: "Industry classification",
        priority: 5,
        status: "open",
        answer: null,
        answeredBy: null,
        answeredAt: null,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) throw created.error;

      // Answer it
      const answered = await repo.answerOnboardingQuestion(
        TEST_WORKSPACE,
        created.data.id,
        "Tech",
        TEST_USER,
      );
      expect(answered.ok).toBe(true);
      if (!answered.ok) throw answered.error;

      const a = answered.data;
      expect(a.status).toBe("answered");
      expect(a.answer).toBe("Tech");
      expect(a.answeredBy).toBe(TEST_USER);
      expect(a.answeredAt).toBeInstanceOf(Date);

      // list preserves the answer and provenance
      const listed = await repo.listOnboardingQuestions({
        workspaceId: TEST_WORKSPACE,
        sessionId: TEST_SESSION,
      });
      expect(listed.ok).toBe(true);
      if (!listed.ok) throw listed.error;

      const match = listed.data.items.find((i) => i.id === created.data.id);
      expect(match).toBeDefined();
      expect(match!.status).toBe("answered");
      expect(match!.answer).toBe("Tech");
      expect(match!.answeredBy).toBe(TEST_USER);
      expect(match!.answeredAt).toBeInstanceOf(Date);
      expect(match!.factKey).toBe("industry");
      expect(match!.options).toEqual(["Tech", "Retail", "Healthcare"]);
    });

    it("workspace isolation — cross-workspace get returns null", async () => {
      // Create question in TEST_WORKSPACE
      const created = await repo.createOnboardingQuestion({
        workspaceId: TEST_WORKSPACE,
        sessionId: TEST_SESSION,
        businessId: TEST_BUSINESS,
        factKey: "revenue",
        questionType: "number",
        question: "Annual revenue?",
        options: null,
        reason: "Revenue estimate",
        priority: 3,
        status: "open",
        answer: null,
        answeredBy: null,
        answeredAt: null,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) throw created.error;

      // Try to get from OTHER_WORKSPACE — should return null (not leak)
      const leaked = await repo.getOnboardingQuestion(
        OTHER_WORKSPACE,
        created.data.id,
      );
      expect(leaked.ok).toBe(true);
      if (!leaked.ok) throw leaked.error;
      expect(leaked.data).toBeNull();
    });

    it("dismiss sets status dismissed without changing answered history", async () => {
      // Create an open question (simulates a gap that extraction will resolve)
      const openQ = await repo.createOnboardingQuestion({
        workspaceId: TEST_WORKSPACE,
        sessionId: TEST_SESSION,
        businessId: TEST_BUSINESS,
        factKey: "target_audience",
        questionType: "text",
        question: "Who is your target audience?",
        options: null,
        reason: "Required for profile",
        priority: 10,
        status: "open",
        answer: null,
        answeredBy: null,
        answeredAt: null,
      });
      expect(openQ.ok).toBe(true);
      if (!openQ.ok) throw openQ.error;

      // Create an already-answered question (should remain untouched)
      const answeredQ = await repo.createOnboardingQuestion({
        workspaceId: TEST_WORKSPACE,
        sessionId: TEST_SESSION,
        businessId: TEST_BUSINESS,
        factKey: "website_url",
        questionType: "text",
        question: "What is your website?",
        options: null,
        reason: "Required for profile",
        priority: 8,
        status: "open",
        answer: null,
        answeredBy: null,
        answeredAt: null,
      });
      expect(answeredQ.ok).toBe(true);
      if (!answeredQ.ok) throw answeredQ.error;

      const answered = await repo.answerOnboardingQuestion(
        TEST_WORKSPACE,
        answeredQ.data.id,
        "https://example.com",
        TEST_USER,
      );
      expect(answered.ok).toBe(true);

      // Dismiss the open question (extraction resolved the gap)
      const dismissed = await repo.dismissOnboardingQuestion(
        TEST_WORKSPACE,
        openQ.data.id,
      );
      expect(dismissed.ok).toBe(true);
      if (!dismissed.ok) throw dismissed.error;
      expect(dismissed.data.status).toBe("dismissed");
      expect(dismissed.data.factKey).toBe("target_audience");

      // Verify the answered question was NOT changed
      const stillAnswered = await repo.getOnboardingQuestion(
        TEST_WORKSPACE,
        answeredQ.data.id,
      );
      expect(stillAnswered.ok).toBe(true);
      if (!stillAnswered.ok) throw stillAnswered.error;
      expect(stillAnswered.data).not.toBeNull();
      expect(stillAnswered.data!.status).toBe("answered");
      expect(stillAnswered.data!.answer).toBe("https://example.com");
    });

    it("dismiss of answered question fails and does not mutate status", async () => {
      // Create a question and answer it
      const created = await repo.createOnboardingQuestion({
        workspaceId: TEST_WORKSPACE,
        sessionId: TEST_SESSION,
        businessId: TEST_BUSINESS,
        factKey: "phone_number",
        questionType: "text",
        question: "Phone number?",
        options: null,
        reason: "Contact info",
        priority: 7,
        status: "open",
        answer: null,
        answeredBy: null,
        answeredAt: null,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) throw created.error;

      const answered = await repo.answerOnboardingQuestion(
        TEST_WORKSPACE,
        created.data.id,
        "+15551234567",
        TEST_USER,
      );
      expect(answered.ok).toBe(true);

      // Attempt to dismiss the already-answered question
      const dismissResult = await repo.dismissOnboardingQuestion(
        TEST_WORKSPACE,
        created.data.id,
      );
      expect(dismissResult.ok).toBe(false);

      // Verify the question is still answered — not mutated
      const verify = await repo.getOnboardingQuestion(
        TEST_WORKSPACE,
        created.data.id,
      );
      expect(verify.ok).toBe(true);
      if (!verify.ok) throw verify.error;
      expect(verify.data).not.toBeNull();
      expect(verify.data!.status).toBe("answered");
      expect(verify.data!.answer).toBe("+15551234567");
      expect(verify.data!.answeredBy).toBe(TEST_USER);
    });
  },
);
