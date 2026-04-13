// ============================================================
// Memory 模块统一导出
// ============================================================

export {
  generateEmbedding,
  generateEmbeddings,
  getEmbeddingApiKey,
  searchMemories,
  searchDocumentChunks,
  EMBEDDING_DIMENSION,
} from "./embedding";

export {
  saveMemory,
  searchRelevantMemories,
  getUserMemories,
  deleteMemory,
  formatMemoriesForPrompt,
} from "./store";
export type { MemoryInput, MemorySearchResult } from "./store";

export {
  splitTextIntoChunks,
  processDocument,
  retrieveRelevantChunks,
  formatChunksForPrompt,
} from "./rag";
