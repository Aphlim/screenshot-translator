/**
 * OCR engine selector. Today we ship two implementations:
 *   - `paddleOcr` (default): PaddleOCR-based, has a text-detection network
 *     that pre-locates text regions before recognition. Best quality on
 *     screenshots with mixed icons / UI chrome.
 *   - `tesseract`: classic single-class engine. Smaller install, available
 *     as a fallback.
 *
 * Phase 6 will lift this constant into electron-store so the user can pick
 * in the settings page.
 */
export { recognizeImage, disposeOcr } from './paddleOcr';
