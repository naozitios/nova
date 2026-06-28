'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, Sparkles, Check, Loader2, AlertCircle, GitCompare, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { processPrompt, applyAction, applyAllActions } from '@/lib/ai';
import type { AIResponse, AIActionItem, ChangePreview } from '@/lib/ai';
import { ensureSeeded } from '@/lib/campaign-engine';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  response?: AIResponse;
  appliedActions?: Set<string>;
}

const suggestions = [
  'Increase budgets for all campaigns by 15%',
  'Duplicate this campaign for Australia',
  'Pause campaigns spending below target ROAS',
  'Create a lookalike audience from my best-performing campaign',
];

function PreviewTable({ previews, actionId, edits, onEdit }: {
  previews: ChangePreview[];
  actionId: string;
  edits: Record<string, Record<string, string>>;
  onEdit: (actionId: string, field: string, value: string) => void;
}) {
  if (previews.length === 0) return null;

  const hasBefore = previews.some(p => p.before);
  const actionEdits = edits[actionId];

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-white text-xs">
      <table className="w-full">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200">
            <th className="text-left px-3 py-2 font-medium text-stone-500 w-[28%]">Field</th>
            {hasBefore && <th className="text-left px-3 py-2 font-medium text-stone-500 w-[28%]">Before</th>}
            <th className="text-left px-3 py-2 font-medium text-stone-500 w-[34%]">After</th>
            <th className="text-right px-3 py-2 w-[10%]" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {previews.map((p, i) => {
            const edited = actionEdits?.[p.field] !== undefined && actionEdits[p.field] !== p.after;
            const currentValue = actionEdits?.[p.field] ?? p.after;
            return (
              <tr key={i} className="hover:bg-stone-50/50">
                <td className="px-3 py-2 font-medium text-stone-700">{p.field}</td>
                {hasBefore && (
                  <td className={`px-3 py-2 ${p.type === 'modify' ? 'text-stone-400 line-through' : 'text-stone-400'}`}>
                    {p.before || '—'}
                  </td>
                )}
                <td className={`px-3 py-2 ${p.type === 'add' ? '' : ''}`}>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={currentValue}
                      onChange={e => onEdit(actionId, p.field, e.target.value)}
                      className={`w-full bg-transparent border-0 border-b border-dashed py-0.5 text-stone-900 font-medium
                        focus:border-purple-500 focus:outline-none focus:ring-0
                        ${p.type === 'add' ? 'text-green-600' : 'text-stone-900'}
                        ${edited ? 'border-purple-400' : 'border-stone-300'}`}
                    />
                    {edited && <Pencil className="w-3 h-3 text-purple-500 flex-shrink-0" />}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  {p.type === 'add' && <span className="text-green-600 font-bold text-xs">+</span>}
                  {p.type === 'remove' && <span className="text-red-600 font-bold text-xs">−</span>}
                  {p.type === 'modify' && <span className={`font-bold text-xs ${edited ? 'text-purple-600' : 'text-amber-600'}`}>~</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function applyEditsToAction(action: AIActionItem, actionEdits: Record<string, string> | undefined): AIActionItem {
  if (!actionEdits) return action;
  const updated = { ...action, params: { ...action.params } };

  if (action.type === 'adjust_budget') {
    const budgetEdit = actionEdits['Budget'];
    if (budgetEdit) {
      const raw = budgetEdit.replace(/[$,]/g, '');
      const parsed = parseInt(raw);
      if (!isNaN(parsed)) updated.params.newBudget = parsed;
    }
  }

  if (action.type === 'duplicate_campaign' || action.type === 'create_campaign') {
    if (actionEdits['Campaign Name']) {
      updated.params.newName = actionEdits['Campaign Name'];
    }
    if (action.type === 'duplicate_campaign' && actionEdits['Countries']) {
      updated.params.countries = actionEdits['Countries'].split(',').map((c: string) => c.trim().toUpperCase());
    }
  }

  return updated;
}

export default function AIPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: 'Hi! I\'m your AI Campaign Assistant. I can help you manage your ad campaigns using natural language. Try one of the suggestions below, or type your own command.',
  }]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [committing, setCommitting] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureSeeded();
  }, []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addSystemMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, { role: 'system', content }]);
  }, []);

  const handleEdit = useCallback((actionId: string, field: string, value: string) => {
    setEdits(prev => ({
      ...prev,
      [actionId]: { ...prev[actionId], [field]: value },
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || processing) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setProcessing(true);

    try {
      const response = await processPrompt(userMsg.content);
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response.message,
        response,
        appliedActions: new Set(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      addSystemMessage('Sorry, I encountered an error processing your request. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleApply = async (rawAction: AIActionItem, msgIndex: number) => {
    const action = applyEditsToAction(rawAction, edits[rawAction.id]);
    setApplying(action.id);
    const result = applyAction(action);
    setApplying(null);

    setMessages(prev => {
      const updated = [...prev];
      const msg = updated[msgIndex];
      if (msg.response) {
        const applied = new Set(msg.appliedActions || []);
        if (result.success) {
          applied.add(action.id);
          setEdits(prev => { const next = { ...prev }; delete next[action.id]; return next; });
        }
        updated[msgIndex] = { ...msg, appliedActions: applied };
      }
      return [...updated, {
        role: 'system' as const,
        content: result.success ? `✓ ${result.message}` : `✗ ${result.message}`,
      }];
    });
  };

  const handleCommitAll = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg.response) return;

    const unapplied = msg.response.actions
      .filter(a => !msg.appliedActions?.has(a.id))
      .map(a => applyEditsToAction(a, edits[a.id]));
    if (unapplied.length === 0) return;

    setCommitting(msgIndex);
    const results = applyAllActions(unapplied);
    setCommitting(null);

    setMessages(prev => {
      const updated = [...prev];
      const m = updated[msgIndex];
      if (m.response) {
        const applied = new Set(m.appliedActions || []);
        for (const r of results) {
          if (r.success) applied.add(r.id);
        }
        updated[msgIndex] = { ...m, appliedActions: applied };
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      const summary = failCount > 0
        ? `✓ ${successCount} change${successCount !== 1 ? 's' : ''} applied, ✗ ${failCount} failed`
        : `✓ All ${successCount} change${successCount !== 1 ? 's' : ''} applied successfully`;
      return [...updated, { role: 'system' as const, content: summary }];
    });

    const appliedIds = results.filter(r => r.success).map(r => r.id);
    setEdits(prev => {
      const next = { ...prev };
      for (const id of appliedIds) delete next[id];
      return next;
    });
  };

  const allApplied = (msg: ChatMessage) => {
    if (!msg.response) return true;
    return msg.response.actions.every(a => msg.appliedActions?.has(a.id));
  };

  return (
    <div className="min-h-screen bg-stone-50 pt-28 pb-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <Badge className="bg-purple-100 text-purple-700 mb-4 px-4 py-1.5 text-sm">
            <Sparkles className="w-4 h-4 mr-1.5 inline" /> AI Campaign Assistant
          </Badge>
          <h1 className="text-4xl md:text-5xl font-light text-stone-900 mb-3">
            AI Campaign Assistant
          </h1>
          <p className="text-lg text-stone-500 max-w-2xl mx-auto">
            Manage your campaigns with natural language. The AI never bypasses the platform — every change flows through the same configuration engine.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
          <div className="h-[560px] overflow-y-auto p-6 space-y-5">
            {messages.map((msg, i) => (
              <AnimatePresence mode="wait" key={i}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user'
                      ? 'bg-stone-900 text-white'
                      : msg.role === 'system'
                        ? 'bg-stone-100 text-stone-500'
                        : 'bg-gradient-to-br from-purple-500 to-purple-600 text-white'
                  }`}>
                    {msg.role === 'user' ? (
                      <span className="text-sm font-medium">U</span>
                    ) : msg.role === 'system' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Bot className="w-5 h-5" />
                    )}
                  </div>

                  <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`rounded-2xl p-4 ${
                      msg.role === 'user'
                        ? 'bg-stone-900 text-white'
                        : msg.role === 'system'
                          ? 'bg-stone-50 text-stone-600 border border-stone-200'
                          : 'bg-stone-50 border border-stone-100'
                    }`}>
                      <p className={`text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'text-white' : 'text-stone-700'}`}>
                        {msg.content}
                      </p>

                      {msg.role === 'assistant' && msg.response && msg.response.actions.length > 0 && (
                        <div className="mt-4 space-y-3 border-t border-stone-200 pt-4">
                          {msg.response.actions.map(action => {
                            const isApplied = msg.appliedActions?.has(action.id);
                            const needsConfirm = msg.response?.requiresConfirmation;
                            return (
                              <div
                                key={action.id}
                                className={`rounded-xl border text-sm transition-all ${
                                  isApplied
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-white border-stone-200'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3 p-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                        action.type === 'adjust_budget' ? 'bg-amber-500' :
                                        action.type === 'duplicate_campaign' ? 'bg-blue-500' :
                                        action.type === 'pause_campaign' ? 'bg-red-500' :
                                        'bg-green-500'
                                      }`} />
                                      <Badge variant="outline" className="text-xs capitalize font-mono px-2 py-0">
                                        {action.type.replace(/_/g, ' ')}
                                      </Badge>
                                      <span className="font-medium text-stone-900 text-sm truncate">
                                        {action.campaignName}
                                      </span>
                                    </div>
                                  </div>
                                  {isApplied ? (
                                    <Badge className="bg-green-100 text-green-700 flex-shrink-0 text-xs">
                                      <Check className="w-3 h-3 mr-1" /> Applied
                                    </Badge>
                                  ) : needsConfirm && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleApply(action, i)}
                                      disabled={applying === action.id}
                                      className="flex-shrink-0 rounded-full text-xs h-7 px-3 bg-purple-600 hover:bg-purple-700"
                                    >
                                      {applying === action.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <><Check className="w-3 h-3 mr-1" /> Apply</>
                                      )}
                                    </Button>
                                  )}
                                </div>

                                {action.previews.length > 0 && !isApplied && (
                                  <div className="px-3 pb-3">
                                    <PreviewTable
                                      previews={action.previews}
                                      actionId={action.id}
                                      edits={edits}
                                      onEdit={handleEdit}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {!allApplied(msg) && (
                            <div className="flex justify-end pt-1">
                              <Button
                                size="sm"
                                onClick={() => handleCommitAll(i)}
                                disabled={committing === i}
                                className="rounded-full text-xs h-8 px-5 bg-purple-700 hover:bg-purple-800 gap-1.5"
                              >
                                {committing === i ? (
                                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Committing...</>
                                ) : (
                                  <><GitCompare className="w-3.5 h-3.5" /> Commit All Changes</>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            ))}

            {messages.length === 1 && (
              <div className="grid grid-cols-2 gap-3 mt-6">
                {suggestions.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    onClick={() => { setInput(s); }}
                    className="text-left p-3 rounded-xl border border-stone-200 bg-white hover:border-purple-300 hover:bg-purple-50/50 transition-all text-sm text-stone-600"
                  >
                    <span className="text-purple-500 mr-1.5">💡</span>
                    {s}
                  </motion.button>
                ))}
              </div>
            )}

            <div ref={chatEnd} />
          </div>

          <div className="border-t border-stone-100 p-4">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a command... e.g. Increase budgets by 15%"
                disabled={processing}
                className="h-12 rounded-2xl bg-stone-50 border-stone-200 px-5"
              />
              <Button
                type="submit"
                disabled={!input.trim() || processing}
                className="h-12 rounded-2xl px-5 bg-purple-600 hover:bg-purple-700 flex-shrink-0"
              >
                {processing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </form>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-2 p-4 rounded-2xl bg-purple-50 border border-purple-100 text-sm text-purple-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>
            <strong>AI safety:</strong> Every AI action generates an execution plan before applying changes. No change is made without your confirmation. All actions are versioned and reversible.
          </span>
        </div>
      </div>
    </div>
  );
}
