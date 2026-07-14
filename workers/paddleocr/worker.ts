// PaddleOCR worker — processes document images via PaddleOCR
// TODO: Implement OCR processing pipeline
export interface OcrJobInput {
  sourceId: string;
  fileUrl: string;
  fileType: string;
}

export interface OcrResult {
  text: string;
  pages: Array<{
    pageNumber: number;
    text: string;
    confidence: number;
  }>;
}

export async function processOcrJob(input: OcrJobInput): Promise<OcrResult> {
  throw new Error("Not implemented");
}
