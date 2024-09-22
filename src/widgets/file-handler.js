import fs from 'fs';
import path from 'path';
import color from 'picocolors';

export const FileHandler = {
  startSequence: '```',
  endSequence: '```',

  extractPathAndContent(data) {
    const lines = data.split('\n');
    
    // Ensure we have at least two lines
    if (lines.length < 2) {
      return { path: null, content: data, writeFile: false, language: '' };
    }

    // First line is the code block language
    const language = lines[0].trim().replace('```', '');
    const secondLine = lines[1].trim();

    // Define comment patterns to check
    const commentPatterns = [
      { start: '//', end: '' },      // Single-line comment
      { start: '<!--', end: '-->' }, // HTML comment
      { start: '/*', end: '*/' },    // Multi-line comment
      { start: '#', end: '' }        // Python-style comment
    ];

    let filePath = null;
    let writeFile = false;
    let content = data;

    // Check if the second line matches any comment pattern
    const matchedPattern = commentPatterns.find(pattern => 
      secondLine.startsWith(pattern.start) && (pattern.end === '' || secondLine.endsWith(pattern.end))
    );

    if (matchedPattern) {
      // Extract file path and check for :W suffix
      const cleanedLine = secondLine
        .replace(matchedPattern.start, '')
        .replace(matchedPattern.end, '')
        .trim();
      const pathMatch = cleanedLine.match(/(.*?)(:W)?$/);
      
      if (pathMatch) {
        filePath = pathMatch[1].trim();
        writeFile = pathMatch[2] === ':W';
        content = lines.slice(2).join('\n')
      }
    }

    return { path: filePath, content, writeFile, language };
  },

  getLastNLines(content, n) {
    const lines = content.split('\n');
    return lines.slice(-n).join('\n');
  },

  callback(event, data) {
    if (!data) return '';

    const { path: filePath, content, writeFile, language } = this.extractPathAndContent(data);

    if (event === 'chunk') {
      const lastLines = this.getLastNLines(content, 5);
      const title = filePath || language || '';
      return `==== ${color.inverse(` ${title} `)} ====\n${lastLines}\n====\n`;
    } else if (event === 'end') {
      if (writeFile && filePath) {
        try {
          const dirPath = path.dirname(filePath);
          fs.mkdirSync(dirPath, { recursive: true });
          fs.writeFileSync(filePath, content);
          console.log(`File saved: ${filePath}`);
        } catch (error) {
          console.error(`Error saving file: ${error}`);
        }
      }

      const lastLines = this.getLastNLines(content, 5);
      const title = filePath || language || '';
      return `==== ${color.inverse(` ${title} `)} ====\n${lastLines}\n====\n`;
    }

    return '';
  }
};

export default FileHandler;