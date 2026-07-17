export interface UploadFixture {
  fileName: string;
  mimeType: string;
  sourceName: string;
  content: Buffer;
}

export const textFixture: UploadFixture = {
  fileName: "business-context.txt",
  mimeType: "text/plain",
  sourceName: "Business Context Notes",
  content: Buffer.from(
    [
      "NOVA sells analytics onboarding for Meta advertisers.",
      "Primary market: US ecommerce brands.",
      "Primary objective: improve campaign setup quality.",
    ].join("\n"),
    "utf8",
  ),
};

export const htmlFixture: UploadFixture = {
  fileName: "business-context.html",
  mimeType: "text/html",
  sourceName: "Business Context HTML",
  content: Buffer.from(
    "<!doctype html><html><body><h1>NOVA</h1><p>Evidence page.</p></body></html>",
    "utf8",
  ),
};

export const pdfFixture: UploadFixture = {
  fileName: "business-context.pdf",
  mimeType: "application/pdf",
  sourceName: "Business Context PDF",
  content: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "utf8"),
};

export const docxFixture: UploadFixture = {
  fileName: "business-context.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  sourceName: "Business Context DOCX",
  content: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]),
};

export const pptxFixture: UploadFixture = {
  fileName: "business-context.pptx",
  mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  sourceName: "Business Context PPTX",
  content: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]),
};

export const xlsxFixture: UploadFixture = {
  fileName: "business-context.xlsx",
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  sourceName: "Business Context XLSX",
  content: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]),
};

export const legacyDocFixture: UploadFixture = {
  fileName: "legacy-context.doc",
  mimeType: "application/msword",
  sourceName: "Legacy Business Context DOC",
  content: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
};

export const executableFixture: UploadFixture = {
  fileName: "malware.bin",
  mimeType: "application/octet-stream",
  sourceName: "Executable Upload",
  content: Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]),
};

export const malformedFixture: UploadFixture = {
  fileName: "malformed.bin",
  mimeType: "application/octet-stream",
  sourceName: "Malformed Upload",
  content: Buffer.from([0x00, 0x01, 0x02, 0x03]),
};

export const emptyFixture: UploadFixture = {
  fileName: "empty.txt",
  mimeType: "text/plain",
  sourceName: "Empty Upload",
  content: Buffer.alloc(0),
};


export const eicarFixture: UploadFixture = {
  fileName: "eicar.txt",
  mimeType: "text/plain",
  sourceName: "EICAR Upload",
  content: Buffer.from(
    "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
    "utf8",
  ),
};
