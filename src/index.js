'use strict';

var Alexa = require("alexa-sdk");
var appId = "";

var instruction = "Say number and operator. For getting answer, please say answer.";
var instruction_for_clearing = "Say yes for clearing, say no for resume the calculation with the statement now I have";
var instruction_detail = "Say number and operator, I'll calculate for you. <break time='1s'/>"
                        + "If you say full statement like one plus five, I'll give you result immediately.  <break time='1s'/>"
                        + "The operator now I support is plus, minus, multiply and divided by.   <break time='1s'/>"
                        + "If you say one number or one operator each, I'll memory your command and by you saying <s>answer</s>, I'll calculate the result.  <break time='1s'/>"
                        + "You also can say one number and operator, like <s>two plus</s> or <s>plus two</s> I'll memory the command for further calculation. <break time='1s'/>"
                        + "I keep memoring statement and number for you. If you want to start from the beginning, please say <s>clear</s>";

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = appId;
    alexa.dynamoDBTableName = "calculator";
    alexa.registerHandlers(newSessionHandlers, initStateHandlers, lastInputIsNumberModeHandlers, lastInputIsOperatorModeHandlers, clearModeHandlers);
    alexa.execute();
};

var states = {
    INITIAL: "_INITIAL", // TODO. it seems a user never be able to go back to '' state? made initial mode for the workaround
    LASTINPUTISNUMBER: "_LASTINPUTISNUMBER", // Last input given by user was number.
    LASTINPUTISOPERATOR: "_LASTINPUTISOPERATOR", // Last input given by user was operator.
    CLEAR: "_CLEAR"  // Asked to clear the holding values.
};

var newSessionHandlers = {
    "LaunchRequest": function() {
      console.log("newSessionHandlers:LaunchRequest");
      this.attributes["numbers"] = [];
      this.attributes["operators"] = [];
      this.emit(":ask", "Ok, please say number and operator",instruction);
    },
    "CalculateAtOnceIntent" : function() {
      console.log("CalculateAtOnceIntent");
      var n1 = parseInt(this.event.request.intent.slots.number_one.value);
      var n2 = parseInt(this.event.request.intent.slots.number_two.value);
      var op = translateOperator(this.event.request.intent.slots.operator.value);
      if (isNaN(n1) || isNaN(n2)) {
        this.emit("Unhandled");
      } else {
        var r = doCalculate(n1+op+n2);
        this.attributes["numbers"] = [r];
        this.attributes["operators"] = [];
        this.handler.state = states.LASTINPUTISNUMBER;
        this.emit(":ask", translateStatementForSay(n1 + op + n2) + " is " + r, instruction);
      }
    },
    "CalculateOneNumberIntent" : function() {
      console.log("CalculateOneNumberIntent");
      var n = parseInt(this.event.request.intent.slots.number.value);
      if (isNaN(n)) {
        this.emit("Unhandled");
      } else {
        this.attributes["numbers"] = [n];
        this.attributes["operators"] = [];
        this.handler.state = states.LASTINPUTISNUMBER;
        this.emit(":ask", "Ok",instruction);
      }
    },
    "CalculateOneOperatorIntent" : function() {
      console.log("CalculateOneOperatorIntent");
      this.emit(":ask", "Input was invalid. Please say number", instruction);
    },
    "CalculateNumberThenOperatorIntent" : function() {
      console.log("CalculateNumberThenOperatorIntent");
      var n = parseInt(this.event.request.intent.slots.number.value);
      if (isNaN(n)) {
        this.emit("Unhandled");
      } else {
        var op = translateOperator(this.event.request.intent.slots.operator.value);
        this.attributes["numbers"] = [n];
        this.attributes["operators"] = [op];
        this.handler.state = states.LASTINPUTISOPERATOR;
        this.emit(":ask", "Ok",instruction);
      }
    },
    "CalculateOperatorThenNumber" : function() {
      console.log("CalculateOperatorThenNumber");
      this.emit(":ask", "Input was invalid. Please say number first.", instruction);
    },
    "AnswerIntent": function() {
      console.log("AnswerIntent");
      this.emit(":ask", "Input was invalid. Please say number for continuing the calculation.",instruction);
    },
    "ClearIntent": function() {
      console.log("ClearIntent");
      this.handler.state = states.CLEAR;
      this.emit(":ask", "I'm going to clear the holding statement. Is it fine?",instruction);
    },
    "AMAZON.StopIntent": function() {
      console.log("StopIntent");
      this.handler.state = states.INITIAL;
      this.attributes["numbers"] = [];
      this.attributes["operators"] = [];
      this.emit(":tell", "Goodbye!");
    },
    "AMAZON.CancelIntent": function() {
      console.log("CancelIntent");
      this.handler.state = states.INITIAL;
      this.attributes["numbers"] = [];
      this.attributes["operators"] = [];
      this.emit(":tell", "Goodbye!");
    },
    "AMAZON.HelpIntent":function() {
      this.emit(":ask",instruction_detail,instruction);
    },
    "SessionEndedRequest": function () {
      console.log("session ended!");
      this.handler.state = states.INITIAL;
      this.attributes["numbers"] = [];
      this.attributes["operators"] = [];
      this.emit(':saveState', true); // Be sure to call :saveState to persist your session attributes in DynamoDB
    },
    "Unhandled": function() {
      console.log("UNHANDLED");
      var statement = translateStatementForSay(generateStatementString(this.attributes["numbers"], this.attributes["operators"]));
      if (statement.length > 0) {
        this.emit(":ask", "Could you say again? Current statement is " + statement, "Say number and operator. For getting answer, please say answer." );
      } else {
        this.emit(":ask", "Could you say again?", "Say number and operator. For getting answer, please say answer." );
      }
    }
};

// TODO. Had this code because it seems one user can not go back to blank state..
var initStateHandlers = Alexa.CreateStateHandler(states.INITIAL, {
    "LaunchRequest": function() {
      this.handler.state = '';
      this.emitWithState('LaunchRequest');
    },
    "CalculateAtOnceIntent" : function() {
      this.handler.state = '';
      this.emitWithState('CalculateAtOnceIntent');
    },
    "CalculateOneNumberIntent" : function() {
      this.handler.state = '';
      this.emitWithState('CalculateOneNumberIntent');
    },
    "CalculateOneOperatorIntent" : function() {
      this.handler.state = '';
      this.emitWithState('CalculateOneOperatorIntent');
    },
    "CalculateNumberThenOperatorIntent" : function() {
      this.handler.state = '';
      this.emitWithState('CalculateNumberThenOperatorIntent');
    },
    "CalculateOperatorThenNumber" : function() {
      this.handler.state = '';
      this.emitWithState('CalculateOperatorThenNumber');
    },
    "AnswerIntent": function() {
      this.handler.state = '';
      this.emitWithState('AnswerIntent');
    },
    "ClearIntent": function() {
      this.handler.state = '';
      this.emitWithState('ClearIntent');
    },
    "AMAZON.StopIntent": function() {
      this.handler.state = '';
      this.emitWithState('AMAZON.StopIntent');
    },
    "AMAZON.CancelIntent": function() {
      this.handler.state = '';
      this.emitWithState('AMAZON.CancelIntent');
    },
    "AMAZON.HelpIntent":function() {
      this.emit(":ask",instruction_detail,instruction);
    },
    "SessionEndedRequest": function () {
      this.handler.state = '';
      this.emitWithState('SessionEndedRequest');
    },
    "Unhandled": function() {
      this.handler.state = '';
      this.emitWithState('initStateHandlers::Unhandled');
    }
});

var lastInputIsNumberModeHandlers = Alexa.CreateStateHandler(states.LASTINPUTISNUMBER, {
  "CalculateAtOnceIntent" : function() {
    console.log("CalculateAtOnceIntent");
    if (this.attributes["operators"].length == 0) {
      // TODO: there may be better way.
      // The call in this condition would be the first request after responding to an answer.
      // Perform CalculateAtOnceIntent for this situation only.
      this.handler.state = states.INITIAL;
      this.emitWithState("CalculateAtOnceIntent");
    } else {
      this.emit(":ask", "Input was invalid. please say operator and then number for continuing the calculation.", "say operator or you need answer, please say answer");
    }
  },
  "CalculateOneNumberIntent" : function() {
    console.log("CalculateOneNumberIntent");
    var n = parseInt(this.event.request.intent.slots.number.value);
    if (isNaN(n)) {
      this.emit("Unhandled");
    } else {
      if (n>=0) {
        var newValueForLastNumber = appendNewNumber(this.attributes["numbers"][this.attributes["numbers"].length-1], n);
        this.attributes["numbers"][this.attributes["numbers"].length-1] = newValueForLastNumber;
        this.handler.state = states.LASTINPUTISNUMBER;
        this.emit(":ask", newValueForLastNumber, instruction);
      } else {
        this.attributes["operators"].push("-");
        this.attributes["numbers"].push(-n);
        this.handler.state = states.LASTINPUTISNUMBER;
        this.emit(":ask", "Ok", instruction);
      }
    }
  },
  "CalculateOneOperatorIntent" : function() {
    console.log("CalculateOneOperatorIntent");
    var op = translateOperator(this.event.request.intent.slots.operator.value);
    this.attributes["operators"].push(op);
    this.handler.state = states.LASTINPUTISOPERATOR;
    this.emit(":ask", "Ok",instruction);
  },
  "CalculateNumberThenOperatorIntent" : function() {
    console.log("CalculateNumberThenOperatorIntent");
    var n = parseInt(this.event.request.intent.slots.number.value);
    if (isNaN(n)) {
      this.emit("Unhandled");
    } else {
      if (n>=0) {
        var newValueForLastNumber = appendNewNumber(this.attributes["numbers"][this.attributes["numbers"].length-1], n);
        this.attributes["numbers"][this.attributes["numbers"].length-1] = newValueForLastNumber;
      } else {
        this.attributes["operators"].push("-");
        this.attributes["numbers"].push(-n);
      }
    }
    var op = translateOperator(this.event.request.intent.slots.operator.value);
    this.attributes["operators"].push(op);
    this.handler.state = states.LASTINPUTISOPERATOR;
    this.emit(":ask", "Ok",instruction);
  },
  "CalculateOperatorThenNumber" : function() {
    console.log("CalculateOperatorThenNumber");
    var op = translateOperator(this.event.request.intent.slots.operator.value);
    var n = parseInt(this.event.request.intent.slots.number.value);
    if (isNaN(n)) {
      this.emit("Unhandled");
    } else {
      this.attributes["operators"].push(op);
      this.attributes["numbers"].push(n);
      this.handler.state = states.LASTINPUTISNUMBER;
      this.emit(":ask", "Ok", instruction);
    }
  },
  "ClearIntent": function() {
    console.log("ClearIntent");
    this.handler.state = states.CLEAR;
    this.emit(":ask", "I'm going to clear the holding statement. Is it fine?",instruction);
  },
  "AnswerIntent": function() {
    var statement = generateStatementString(this.attributes["numbers"], this.attributes["operators"]);
    console.log("statement:" + statement);
    if (this.attributes["operators"].length == 0) {
      this.emit(":ask", "Input is not complete. please say at least one operator for the calculation. Current statement is " + statement,
        instruction);
    } else if (this.attributes["operators"].length + 1 != this.attributes["numbers"].length) {
      this.emit(":ask", "Input is not complete. Current statement is " + statement + ". Please say number for the calculation.",
        instruction);
    } else {
      var r = doCalculate(statement);
      this.attributes["numbers"] = [r];
      this.attributes["operators"] = [];
      this.handler.state = states.LASTINPUTISNUMBER;
      this.emit(":ask", translateStatementForSay(statement) + " is " + r, instruction);
    }
  },
  "AMAZON.StopIntent": function() {
    this.handler.state = states.INITIAL;
    this.emitWithState('AMAZON.StopIntent');
  },
  "AMAZON.CancelIntent": function() {
    this.handler.state = states.INITIAL;
    this.emitWithState('AMAZON.CancelIntent');
  },
  "AMAZON.HelpIntent":function() {
    this.emit(":ask",instruction_detail,instruction);
  },
  "SessionEndedRequest": function () {
    this.handler.state = states.INITIAL;
    this.emitWithState('SessionEndedRequest');
  },
  "Unhandled": function() {
    console.log("lastInputIsNumberModeHandlers::UNHANDLED");
    var statement = translateStatementForSay(generateStatementString(this.attributes["numbers"], this.attributes["operators"]));
    if (statement.length > 0) {
      this.emit(":ask", "Could you say again? Current statement is " + statement, "Say number and operator. For getting answer, please say answer." );
    } else {
      this.emit(":ask", "Could you say again?", "Say number and operator. For getting answer, please say answer." );
    }
  }
});

var lastInputIsOperatorModeHandlers = Alexa.CreateStateHandler(states.LASTINPUTISOPERATOR, {
  "CalculateAtOnceIntent" : function() {
    console.log("CalculateAtOnceIntent");
    var n1 = parseInt(this.event.request.intent.slots.number_one.value);
    var n2 = parseInt(this.event.request.intent.slots.number_two.value);
    var op = translateOperator(this.event.request.intent.slots.operator.value);
    if (isNaN(n1) || isNaN(n2)) {
      this.emit("Unhandled");
    } else {
      this.attributes["numbers"].push(n1);
      this.attributes["numbers"].push(n2);
      this.attributes["operators"].push(op);
      this.handler.state = states.LASTINPUTISNUMBER;
      this.emit(":ask", "Ok", "say operator or you need answer, please say answer");
    }
  },
  "CalculateOneNumberIntent" : function() {
    console.log("CalculateOneNumberIntent");
    var n = parseInt(this.event.request.intent.slots.number.value);
    if (isNaN(n)) {
      this.emit("Unhandled");
    } else {
      this.attributes["numbers"].push(n);
      this.handler.state = states.LASTINPUTISNUMBER;
      this.emit(":ask", "Ok", instruction);
    }
  },
  "CalculateOneOperatorIntent" : function() {
    console.log("CalculateOneOperatorIntent");
    this.emit(":ask", "input was invalid. please say number for continuing the calculation.",instruction);
  },
  "CalculateNumberThenOperatorIntent" : function() {
    console.log("CalculateNumberThenOperatorIntent");
    var n = parseInt(this.event.request.intent.slots.number.value);
    var op = translateOperator(this.event.request.intent.slots.operator.value);
    if (isNaN(n)) {
      this.emit("Unhandled");
    } else {
      this.attributes["numbers"].push(n);
      this.attributes["operators"].push(op);
      this.handler.state = states.LASTINPUTISOPERATOR;
      this.emit(":ask", "Ok",instruction);
    }
  },
  "CalculateOperatorThenNumber" : function() {
    console.log("CalculateOperatorThenNumber");
    this.emit(":ask", "input was invalid. please say number for continuing the calculation.",instruction);
  },
  "AnswerIntent": function() {
    console.log("AnswerIntent");
    this.emit(":ask", "input was invalid. please say number for continuing the calculation.",instruction);
  },
  "ClearIntent": function() {
    console.log("ClearIntent");
    this.handler.state = states.CLEAR;
    this.emit(":ask", "I'm going to clear the holding value. Is it fine?",instruction);
  },
  "AMAZON.StopIntent": function() {
    this.handler.state = states.INITIAL;
    this.emitWithState('AMAZON.StopIntent');
  },
  "AMAZON.CancelIntent": function() {
    this.handler.state = states.INITIAL;
    this.emitWithState('AMAZON.CancelIntent');
  },
  "AMAZON.HelpIntent":function() {
    this.emit(":ask",instruction_detail,instruction);
  },
  "SessionEndedRequest": function () {
    this.handler.state = states.INITIAL;
    this.emitWithState('SessionEndedRequest');
  },
  "Unhandled": function() {
    console.log("lastInputIsOperatorModeHandlers::UNHANDLED");
    var statement = translateStatementForSay(generateStatementString(this.attributes["numbers"], this.attributes["operators"]));
    if (statement.length > 0) {
      this.emit(":ask", "Could you say again? Current statement is " + statement, "Say number and operator. For getting answer, please say answer." );
    } else {
      this.emit(":ask", "Could you say again?", "Say number and operator. For getting answer, please say answer." );
    }
  }
});

var clearModeHandlers = Alexa.CreateStateHandler(states.CLEAR, {
  'AMAZON.YesIntent': function() {
    this.attributes["numbers"] = [];
    this.attributes["operators"] = [];
    this.handler.state = states.INITIAL;
    this.emit(":ask", "Ok. I removed the holding calculation statement", instruction);
  },
  'AMAZON.NoIntent': function() {
    if (this.attributes["numbers"].length == this.attributes["operators"].length) {
      this.handler.state = states.LASTINPUTISOPERATOR;
    } else {
      this.handler.state = states.LASTINPUTISNUMBER;
    }
    this.emit(":ask", "Ok. I hold current value", instruction);
  },
  "AMAZON.StopIntent": function() {
    this.handler.state = states.INITIAL;
    this.emitWithState('AMAZON.StopIntent');
  },
  "AMAZON.CancelIntent": function() {
    this.handler.state = states.INITIAL;
    this.emitWithState('AMAZON.CancelIntent');
  },
  "SessionEndedRequest": function () {
    this.handler.state = states.INITIAL;
    this.emitWithState('SessionEndedRequest');
  },
  "AMAZON.HelpIntent":function() {
    this.emit(":ask",instruction_detail,instruction);
  },
  "Unhandled": function() {
    console.log("clearModeHandlers::UNHANDLED");
    this.emit(":ask", instruction_for_clearing,instruction_for_clearing);
  }
});

function doCalculate(statement) {
  console.log("doCalculate statement:" + statement);
  return eval(statement);
};

function appendNewNumber(original, appendingNumber) {
  console.log("appendNewNumber original:" + original + "   appendingNumber:" + appendingNumber);
  if (appendingNumber >= 0) {
    var shiftValue = 0;
    if (appendingNumber == 0) {
      shiftValue = 1;
    } else {
      shiftValue = Math.floor(Math.log10(appendingNumber)) + 1;
    }
    console.log("appendNewNumber shiftValue:" + shiftValue);
    return original * Math.pow(10,shiftValue) + appendingNumber;
  } else {
    throw new Error("Invalid value");
  }
};

function translateOperator(operator) {
  var r = "";
  switch (operator) {
    case "plus":
      r = "+";
      break;
    case "minus":
      r = "-";
      break;
    case "multiply":
      r = "*";
      break;
    case "divided by":
      r = "/";
      break;
    default:
  }
  return r;
};

function translateStatementForSay(statement) {
  var v = statement.replace(/\*/g , " multiply ");
  var v = v.replace(/\//g , " divided by " );
  var v = v.replace(/\-/g , " minus " );
  var v = v.replace(/\+/g , " plus " );
  return v;
}

function generateStatementString(numbers,operators) {
  var statement = "";
  for (var i = 0; i < operators.length; i++) {
    statement += (numbers[i] + operators[i]);
  }
  if (i < numbers.length) {
    statement += numbers[i];
  }
  return statement;
}
