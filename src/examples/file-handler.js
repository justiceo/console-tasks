import fs from 'fs';
import path from 'path';

export const FileHandler = {
  startSequence: '<file>',
  endSequence: '</file>',

  extractPathAndContent(data, isChunk = false) {
    const pathMatch = data.match(/<path>(.*?)<\/path>/);
    let contentMatch;

    if (isChunk) {
      // For chunks, make the closing </content> tag optional
      contentMatch = data.match(/<content>([\s\S]*?)(<\/content>)?$/);
    } else {
      // For complete data, require the closing </content> tag
      contentMatch = data.match(/<content>([\s\S]*?)<\/content>/);
    }

    return {
      path: pathMatch ? pathMatch[1] : '',
      content: contentMatch ? contentMatch[1] : '',
    };
  },

  getLastNLines(content, n) {
    const lines = content.split('\n');
    return lines.slice(-n).join('\n');
  },

  callback(event, data) {
    if (!data) return '';

    const { path: filePath, content } = this.extractPathAndContent(data, event === 'chunk');

    if (event === 'chunk') {
      const lastLines = this.getLastNLines(content, 5);
      return `${filePath}\n${lastLines}`;
    } else if (event === 'end') {
      try {
        const dirPath = path.dirname(filePath);
        fs.mkdirSync(dirPath, { recursive: true });
        fs.writeFileSync(filePath, content);
        console.log(`File saved: ${filePath}`);
      } catch (error) {
        console.error(`Error saving file: ${error}`);
      }

      const lastLines = this.getLastNLines(content, 5);
      return `${filePath}\n${lastLines}`;
    }

    return '';
  }
};

export default FileHandler;