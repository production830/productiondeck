import {test} from 'node:test';
import assert from 'node:assert/strict';
import {describeAIError} from '../public/ai-errors.js';
test('AI failures identify downloads, engine startup, memory, cache and photo decoding separately',()=>{
 for(const [message,stage,code] of [
  ['Failed to fetch dynamically imported module','runtime','ai_runtime_download'],
  ['Could not locate file: 404','loading','ai_model_download'],
  ['TypeError: Failed to fetch','loading','ai_model_download'],
  ['no available backend found. wasm failed','loading','ai_engine'],
  ['WebAssembly.CompileError','loading','ai_engine'],
  ['memory access out of bounds','analyzing','ai_memory'],
  ['Quota exceeded in cache','loading','ai_cache'],
  ['The source image could not be decoded','analyzing','ai_photo']
 ])assert.equal(describeAIError(Error(message),stage).code,code);
});
test('AI diagnostic details remove download links and credentials and remain bounded',()=>{
 const result=describeAIError(Error('Failed to fetch https://example.test/file?token=private Bearer secret\n'+ 'x'.repeat(1000)));
 assert(!result.detail.includes('private'));assert(!result.detail.includes('secret'));assert(!result.detail.includes('https://'));assert(!result.detail.includes('\n'));assert(result.detail.length<=320);
});
