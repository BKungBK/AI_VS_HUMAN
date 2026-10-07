const segmenter = new Intl.Segmenter('th', {granularity:'grapheme'});
export const graphemeCount = (text:string) => [...segmenter.segment(text)].length;
export function prepareCaption(text:string) {
 const normalized=text.normalize('NFC').trim();
 const count=graphemeCount(normalized);
 if(count>80)throw new Error('CAPTION_TOO_LONG');
 if(/[<>]|(?:https?:\/\/|www\.)|[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/iu.test(normalized))throw new Error('CAPTION_FORMAT');
 return {text:normalized,graphemeCount:count};
}
