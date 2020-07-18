// Symbols
//
//(SP, LCL, ARG, THIS, THAT, RO-R15, SCREEN, KBD)
// Instructions
//
// A-instruction
// @value where value is either a non-negative decimal number
// or a symbol refering such a number
// C-instuction
// dest=comp;jump

// SymbolTable
//
// Maintain the correspondence between symbols and their meaning

var fs = require("fs");

class SymbolTable {
  constructor() {
    this.symTable = {};
  }

  // Adds the pair to the table
  addEntry(symbol, address) {
    this.symTable[symbol] = address;
  }
  // Does the symbol table contains symbol
  contains(symbol) {
    return this.symTable[symbol] !== undefined;
  }
  //Return the address associated with the symbol
  getAddress(symbol) {
    return this.symTable[symbol];
  }
}

let symbolTable = new SymbolTable();
function loadPreDefinedSymbols() {
  // symbol, RAM address
  let specRAMLocations = {
    SP: 0,
    LCL: 1,
    ARG: 2,
    THIS: 3,
    THAT: 4,
    SCREEN: 16384,
    KBD: 24576,
    R0: 0,
    R1: 1,
    R2: 2,
    R3: 3,
    R4: 4,
    R5: 5,
    R6: 5,
    R7: 7,
    R8: 8,
    R9: 9,
    R10: 10,
    R11: 11,
    R12: 12,
    R13: 13,
    R14: 14,
    R15: 15,
  };
  for (const [k, v] of Object.entries(specRAMLocations)) {
    symbolTable.addEntry(k, v);
  }
}

// Translates,decodes, assembly lang mnemonics into binary codes
class Code {
  constructor() {
    this.codeTable = {};
    this.destTable = {
      null: "000",
      M: "001",
      D: "010",
      MD: "011",
      A: "100",
      AM: "101",
      AD: "110",
      AMD: "111",
    };

    this.compTable = {
      M: "1110000",
      D: "0001100",
      "-D": "0001111",
      "D-M": "1010011",
      "D+1": "0011111",
      0: "0101010",
    };

    this.jumpTable = {
      null: "000",
      JGT: "001",
      JEQ: "010",
      JGE: "011",
      JLT: "100",
      JNE: "101",
      JLE: "110",
      JMP: "111",
    };
  }

  dest(mnemonic) {
    return this.destTable[mnemonic];
  }

  comp(mnemonic) {
    return this.compTable[mnemonic];
  }

  jmp(mnemonic) {
    return this.jumpTable[mnemonic];
  }

  translateCCommand(comp, dest, jmp) {
    return ["111", this.comp(comp), this.dest(dest), this.jmp(jmp)].join("");
  }
}

//
// Parser
// Break each assembly comman into components(fields, symbols)
// Remove whitespaces and comments
class Parser {
  constructor(source) {
    this.source = source.trim();
    this.commands = this.getCommands();
    // console.log("commands", this.commands);
    this.line = 0; // ROM address
    this.current = 0;
    this.tokens = [];
    this.nextRAMAddr = 16;
  }

  // Build  the symbol table
  firstPass() {
    while (this.hasMoreCommands()) {
      let commandType = this.commandType();
      switch (commandType) {
        case "A_COMMAND":
          this.line += 1;
          break;
        case "C_COMMAND":
          this.line += 1;
          break;
        case "L_COMMAND":
          symbolTable.addEntry(this.label_symbol(), this.line);
          break;
        default:
          break;
      }

      this.advance();
    }
  }

  secondPass() {
    let binaryInst = [];
    this.current = 0;
    let code = new Code();
    while (this.hasMoreCommands()) {
      let commandType = this.commandType();
      switch (commandType) {
        case "A_COMMAND":
          let numberConstant = this.var_symbol();
          let binaryStr = parseInt(numberConstant, 10).toString(2);
          let leadingZeroCount = 15 - binaryStr.length;
          let leadingZeros = "0".repeat(leadingZeroCount);
          binaryInst.push(`0${leadingZeros}${binaryStr}`);
          break;
        case "C_COMMAND":
          let { dest, comp, jmp } = this.fields();
          binaryInst.push(code.translateCCommand(comp, dest, jmp));
          break;
        default:
          break;
      }

      this.advance();
    }
    console.log(binaryInst.join("\n"));
    // fs.writeFileSync(`${__dirname}/out.hack`, binaryInst.join("\r\n"));
  }

  // xxx where not predefined and is not not defined elsewhere using (xxx)
  // Variables are mapped to consecutive memory address as they are first encountered
  // Starting from at RAM adress 16(0x0010)
  var_symbol() {
    let symbol = this.currentCommand().slice(1);
    if (typeof symbol === "number") {
      return symbol;
    }
    if (!symbolTable.contains(symbol)) {
      symbolTable.addEntry(symbol, this.nextRAMAddr);
      this.nextRAMAddr += 1;
    }
    return symbolTable.getAddress(symbol);
  }

  //(xxx) where xxx refers intstruction memory address holding the next command
  label_symbol() {
    return this.currentCommand().slice(1, -1);
  }

  // Returns comp mnemonic in the C-command
  // dest=comp;jump
  fields() {
    let indexOfEq = this.currentCommand().indexOf("=");
    //dest part mising dest=comp
    if (indexOfEq === -1) {
      let [comp, jmp] = this.currentCommand().split(";");
      return {
        dest: null,
        comp: comp,
        jmp: jmp,
      };
    }

    let indexOfCom = this.currentCommand().indexOf(";");
    // jmp part missing comp;jmp
    if (indexOfCom === -1) {
      let [dest, comp] = this.currentCommand().split("=");
      return {
        dest: dest,
        comp: comp,
        jmp: null,
      };
    }

    // full
    comp = this.currentCommand().slice(indexOfEq + 1, indexOfCom);
    dest = this.currentCommand().slice("=")[0];
    jmpt = this.currentCommand().slice(";")[1];

    return {
      dest: dest,
      comp: comp,
      jmp: jmp,
    };
  }

  getCommands() {
    return this.source.split(/[\r\n]+/);
  }

  hasMoreCommands() {
    return this.current < this.commands.length;
  }

  currentCommand() {
    let currentLineText = this.commands[this.current].trim();
    let commentIndex = currentLineText.indexOf("//");
    if (commentIndex !== -1 && commentIndex !== 0) {
      currentLineText = currentLineText.slice(0, commentIndex);
    }
    return currentLineText.trim();
  }

  advance() {
    this.current += 1;
    this.commands[this.current - 1];
  }

  commandType() {
    if (this.currentCommand().startsWith("@")) {
      return "A_COMMAND";
    }
    if (this.currentCommand().startsWith("(")) {
      return "L_COMMAND";
    }
    if (this.currentCommand().startsWith("//")) {
      return "COMMENT";
    }
    return "C_COMMAND";
  }
}

function main() {
  let args = process.argv.slice(2);
  let source = fs.readFileSync(`${__dirname}/${args[0]}`, {
    encoding: "utf-8",
  });

  //console.log("Source:", source);
  loadPreDefinedSymbols();
  parser = new Parser(source);
  parser.firstPass();
  parser.secondPass();
  // console.log("Symbol Table", symbolTable);
}

main();
