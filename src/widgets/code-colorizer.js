import pc from "picocolors";
import { parse } from "acorn";
import { simple as walk } from "acorn-walk";

export class CodeColorizer {
  constructor() {
    this.themes = {
      // VSCode Dark+ theme colors
      darkPlus: {
        keyword: pc.magenta,
        string: pc.yellow,
        number: pc.cyan,
        comment: pc.green,
        punctuation: pc.white,
        operator: pc.white,
        identifier: pc.blue,
        default: pc.white,
      },
      // Add more themes here if needed
    };
  }

  colorFormat(sourceCode, language) {
    const theme = this.themes.darkPlus; // Using Dark+ theme by default
    let coloredCode = "";
    let lastIndex = 0;

    try {
      const ast = parse(sourceCode, {
        ecmaVersion: 2022,
        sourceType: "module",
      });

      walk(ast, {
        Identifier(node) {
          coloredCode += sourceCode.slice(lastIndex, node.start);
          coloredCode += theme.identifier(
            sourceCode.slice(node.start, node.end)
          );
          lastIndex = node.end;
        },
        Literal(node) {
          coloredCode += sourceCode.slice(lastIndex, node.start);
          if (typeof node.value === "string") {
            coloredCode += theme.string(sourceCode.slice(node.start, node.end));
          } else if (typeof node.value === "number") {
            coloredCode += theme.number(sourceCode.slice(node.start, node.end));
          } else {
            coloredCode += theme.default(
              sourceCode.slice(node.start, node.end)
            );
          }
          lastIndex = node.end;
        },
        Keyword(node) {
          coloredCode += sourceCode.slice(lastIndex, node.start);
          coloredCode += theme.keyword(sourceCode.slice(node.start, node.end));
          lastIndex = node.end;
        },
        Punctuator(node) {
          coloredCode += sourceCode.slice(lastIndex, node.start);
          coloredCode += theme.punctuation(
            sourceCode.slice(node.start, node.end)
          );
          lastIndex = node.end;
        },
      });

      // Add any remaining code
      coloredCode += sourceCode.slice(lastIndex);

      // Color comments (not caught by AST)
      coloredCode = this.colorComments(coloredCode, theme);

      return coloredCode;
    } catch (error) {
      console.error("Error parsing code:", error);
      return sourceCode; // Return original code if parsing fails
    }
  }

  colorComments(code, theme) {
    const singleLineCommentRegex = /\/\/.*/g;
    const multiLineCommentRegex = /\/\*[\s\S]*?\*\//g;

    code = code.replace(singleLineCommentRegex, (match) =>
      theme.comment(match)
    );
    code = code.replace(multiLineCommentRegex, (match) => theme.comment(match));

    return code;
  }
}
