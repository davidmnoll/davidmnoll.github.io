declare module "*.md" {
    const value: any;
    export default value;
}

declare module 'highlightjs-lean' {
  import { LanguageFn } from 'highlight.js';
  const lean: LanguageFn;
  export default lean;
}