'use strict';

var Alexa = require("alexa-sdk");
var appId = "";

var instruction = "Say number and operator. For getting answer, please say answer.";
var instruction_for_clearing = "Say yes for clearing, say no for resume the calculation with the statement now I have";
var instruction_detail = "Say number and operator, I'll calculate for you. <break time='0.8s'/>"
                        + "If you say two numbers and one operator in between, like one plus five, I'll give you the result immediately.  <break time='0.8s'/>"
                        + "The operator now I support is plus, minus, multiply and divided by.   <break time='0.8s'/>"
                        + "If you say one number or one operator each, I'll memory your command and by you saying <s>answer</s>, I'll calculate the result.  <break time='0.8s'/>"
                        + "You also can say one number and one operator in a command, like <s>two plus</s> or <s>plus two</s> I'll memory the command for further calculation. <break time='0.8s'/>"
                        + "I keep memoring your command until you say answer. <break time='0.8s'/> If you want clear the memoried commands and want to start from the beginning, please say <s>clear</s>";

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
      console.log("newSessionHandlers::newSessionHandlers:LaunchRequest");
      this.attributes["numbers"] = [];
      this.attributes["operators"] = [];
      this.emit(":ask", "Ok, please say number and operator",instruction);
    },
    "CalculateAtOnceIntent" : function() {
      console.log("newSessionHandlers::CalculateAtOnceIntent");
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
      console.log("newSessionHandlers::CalculateOneNumberIntent");
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
      console.log("newSessionHandlers::CalculateOneOperatorIntent");
      this.emit(":ask", "Input was invalid. Please say number", instruction);
    },
    "CalculateNumberThenOperatorIntent" : function() {
      console.log("newSessionHandlers::CalculateNumberThenOperatorIntent");
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
      console.log("newSessionHandlers::CalculateOperatorThenNumber");
      this.emit(":ask", "Input was invalid. Please say number first.", instruction);
    },
    "AnswerIntent": function() {
      console.log("newSessionHandlers::AnswerIntent");
      this.emit(":ask", "Input was invalid. Please say number for continuing the calculation.",instruction);
    },
    "ClearIntent": function() {
      console.log("newSessionHandlers::ClearIntent");
      this.handler.state = states.CLEAR;
      this.emit(":ask", "I'm going to clear the holding statement. Is it fine?",instruction);
    },
    "AMAZON.StopIntent": function() {
      console.log("newSessionHandlers::StopIntent");
      this.handler.state = states.INITIAL;
      this.attributes["numbers"] = [];
      this.attributes["operators"] = [];
      this.emit(":tell", "Goodbye!");
    },
    "AMAZON.CancelIntent": function() {
      console.log("newSessionHandlers::CancelIntent");
      this.handler.state = states.INITIAL;
      this.attributes["numbers"] = [];
      this.attributes["operators"] = [];
      this.emit(":tell", "Goodbye!");
    },
    "AMAZON.HelpIntent":function() {
      console.log("newSessionHandlers::HelpIntent");
      this.emit(":ask",instruction_detail,instruction);
    },
    "SessionEndedRequest": function () {
      console.log("newSessionHandlers::SessionEndedRequest");
      this.handler.state = states.INITIAL;
      this.attributes["numbers"] = [];
      this.attributes["operators"] = [];
      this.emit(':saveState', true); // Be sure to call :saveState to persist your session attributes in DynamoDB
    },
    "Unhandled": function() {
      console.log("newSessionHandlers::UNHANDLED");
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
      console.log("initStateHandlers::newSessionHandlers:LaunchRequest");
      this.handler.state = '';
      this.emitWithState('LaunchRequest');
    },
    "CalculateAtOnceIntent" : function() {
      console.log("initStateHandlers::CalculateAtOnceIntent");
      this.handler.state = '';
      this.emitWithState('CalculateAtOnceIntent');
    },
    "CalculateOneNumberIntent" : function() {
      console.log("initStateHandlers::CalculateOneNumberIntent");
      this.handler.state = '';
      this.emitWithState('CalculateOneNumberIntent');
    },
    "CalculateOneOperatorIntent" : function() {
      console.log("initStateHandlers::CalculateOneOperatorIntent");
      this.handler.state = '';
      this.emitWithState('CalculateOneOperatorIntent');
    },
    "CalculateNumberThenOperatorIntent" : function() {
      console.log("initStateHandlers::CalculateNumberThenOperatorIntent");
      this.handler.state = '';
      this.emitWithState('CalculateNumberThenOperatorIntent');
    },
    "CalculateOperatorThenNumber" : function() {
      console.log("initStateHandlers::CalculateOperatorThenNumber");
      this.handler.state = '';
      this.emitWithState('CalculateOperatorThenNumber');
    },
    "AnswerIntent": function() {
      console.log("initStateHandlers::AnswerIntent");
      this.handler.state = '';
      this.emitWithState('AnswerIntent');
    },
    "ClearIntent": function() {
      console.log("initStateHandlers::ClearIntent");
      this.handler.state = '';
      this.emitWithState('ClearIntent');
    },
    "AMAZON.StopIntent": function() {
      console.log("initStateHandlers::StopIntent");
      this.handler.state = '';
      this.emitWithState('AMAZON.StopIntent');
    },
    "AMAZON.CancelIntent": function() {
      console.log("initStateHandlers::CancelIntent");
      this.handler.state = '';
      this.emitWithState('AMAZON.CancelIntent');
    },
    "AMAZON.HelpIntent":function() {
      console.log("initStateHandlers::HelpIntent");
      this.emit(":ask",instruction_detail,instruction);
    },
    "SessionEndedRequest": function () {
      console.log("initStateHandlers::SessionEndedRequest");
      this.handler.state = '';
      this.emitWithState('SessionEndedRequest');
    },
    "Unhandled": function() {
      console.log("initStateHandlers::Unhandled");
      this.handler.state = '';
      this.emitWithState('initStateHandlers::Unhandled');
    }
});

var lastInputIsNumberModeHandlers = Alexa.CreateStateHandler(states.LASTINPUTISNUMBER, {
  "CalculateAtOnceIntent" : function() {
    console.log("lastInputIsNumberModeHandlers::CalculateAtOnceIntent");
    this.emit(":ask", "Input was invalid. please say operator and then number for continuing the calculation.", "say operator or you need answer, please say answer");
  },
  "CalculateOneNumberIntent" : function() {
    console.log("lastInputIsNumberModeHandlers::CalculateOneNumberIntent");
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
    console.log("lastInputIsNumberModeHandlers::CalculateOneOperatorIntent");
    var op = translateOperator(this.event.request.intent.slots.operator.value);
    this.attributes["operators"].push(op);
    this.handler.state = states.LASTINPUTISOPERATOR;
    this.emit(":ask", "Ok",instruction);
  },
  "CalculateNumberThenOperatorIntent" : function() {
    console.log("lastInputIsNumberModeHandlers::CalculateNumberThenOperatorIntent");
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
    console.log("lastInputIsNumberModeHandlers::CalculateOperatorThenNumber");
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
    console.log("lastInputIsNumberModeHandlers::ClearIntent");
    this.handler.state = states.CLEAR;
    this.emit(":ask", "I'm going to clear the holding statement. Is it fine?",instruction);
  },
  "AnswerIntent": function() {
    console.log("lastInputIsNumberModeHandlers::AnswerIntent");
    var statement = generateStatementString(this.attributes["numbers"], this.attributes["operators"]);
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
    console.log("lastInputIsNumberModeHandlers::StopIntent");
    this.handler.state = states.INITIAL;
    this.emitWithState('AMAZON.StopIntent');
  },
  "AMAZON.CancelIntent": function() {
    console.log("lastInputIsNumberModeHandlers::CancelIntent");
    this.handler.state = states.INITIAL;
    this.emitWithState('AMAZON.CancelIntent');
  },
  "AMAZON.HelpIntent":function() {
    console.log("lastInputIsNumberModeHandlers::HelpIntent");
    this.emit(":ask",instruction_detail,instruction);
  },
  "SessionEndedRequest": function () {
    console.log("lastInputIsNumberModeHandlers::SessionEndedRequest");
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
    console.log("lastInputIsOperatorModeHandlers::CalculateAtOnceIntent");
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
    console.log("lastInputIsOperatorModeHandlers::CalculateOneNumberIntent");
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
    console.log("lastInputIsOperatorModeHandlers::CalculateOneOperatorIntent");
    this.emit(":ask", "input was invalid. please say number for continuing the calculation.",instruction);
  },
  "CalculateNumberThenOperatorIntent" : function() {
    console.log("lastInputIsOperatorModeHandlers::CalculateNumberThenOperatorIntent");
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
    console.log("lastInputIsOperatorModeHandlers::CalculateOperatorThenNumber");
    this.emit(":ask", "input was invalid. please say number for continuing the calculation.",instruction);
  },
  "AnswerIntent": function() {
    console.log("lastInputIsOperatorModeHandlers::AnswerIntent");
    this.emit(":ask", "input was invalid. please say number for continuing the calculation.",instruction);
  },
  "ClearIntent": function() {
    console.log("lastInputIsOperatorModeHandlers::ClearIntent");
    this.handler.state = states.CLEAR;
    this.emit(":ask", "I'm going to clear the holding value. Is it fine?",instruction);
  },
  "AMAZON.StopIntent": function() {
    console.log("lastInputIsOperatorModeHandlers::StopIntent");
    this.handler.state = states.INITIAL;
    this.emitWithState('AMAZON.StopIntent');
  },
  "AMAZON.CancelIntent": function() {
    console.log("lastInputIsOperatorModeHandlers::CancelIntent");
    this.handler.state = states.INITIAL;
    this.emitWithState('AMAZON.CancelIntent');
  },
  "AMAZON.HelpIntent":function() {
    console.log("lastInputIsOperatorModeHandlers::HelpIntent");
    this.emit(":ask",instruction_detail,instruction);
  },
  "SessionEndedRequest": function () {
    console.log("lastInputIsOperatorModeHandlers::SessionEndedRequest");
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
    console.log("clearModeHandlers::AMAZON.YesIntent");
    this.attributes["numbers"] = [];
    this.attributes["operators"] = [];
    this.handler.state = states.INITIAL;
    this.emit(":ask", "Ok. I removed the holding calculation statement", instruction);
  },
  'AMAZON.NoIntent': function() {
    console.log("clearModeHandlers::AMAZON.NoIntent");
    if (this.attributes["numbers"].length == this.attributes["operators"].length) {
      this.handler.state = states.LASTINPUTISOPERATOR;
    } else {
      this.handler.state = states.LASTINPUTISNUMBER;
    }
    this.emit(":ask", "Ok. I hold current value", instruction);
  },
  "AMAZON.StopIntent": function() {
    console.log("clearModeHandlers::StopIntent");
    this.handler.state = states.INITIAL;
    this.emitWithState('AMAZON.StopIntent');
  },
  "AMAZON.CancelIntent": function() {
    console.log("clearModeHandlers::CancelIntent");
    this.handler.state = states.INITIAL;
    this.emitWithState('AMAZON.CancelIntent');
  },
  "SessionEndedRequest": function () {
    console.log("clearModeHandlers::SessionEndedRequest");
    this.handler.state = states.INITIAL;
    this.emitWithState('SessionEndedRequest');
  },
  "AMAZON.HelpIntent":function() {
    console.log("clearModeHandlers::HelpIntent");
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
  if (appendingNumber >= 0) {
    var shiftValue = 0;
    if (appendingNumber == 0) {
      shiftValue = 1;
    } else {
      shiftValue = Math.floor(Math.log10(appendingNumber)) + 1;
    }
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
