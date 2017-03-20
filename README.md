# calculator-skill-sample

## About
This is a sample Amazon alexa skill for excercing the alexa-sdk for Node.js.  
This skill calculate numbers given by user.  
If you say statement like 1 + 5, Alexa'll give the result immediately.  
The operator now this skill support is "plus", "minus", "multiply" and "divided by".  
If you say one number or one operator each, Alexa'll memory the command and by you saying "Answer", Alexa'll calculate the result and memorize the result for the further calculation.  
User also can say one number and operator, like 2 + or + 2, Alexa'll memory the command for further calculation.   
Alexa keep memoring statement and number. If user want to start from the beginning, user say "clear" for clearing the holding statement.  

Example of the interaction:  

  * User: 1+2  
  * Alexa: 1+3 is 4  
  * User: + 4  
  * Alexa: Ok  
  * User: multiply 2  
  * Alexa: Ok  
  * User: answer  
  * Alexa: 4 + 4 * 2 is 12  
  * User: divided by 3  
  * Alexa: Ok  
  * User: Answer  
  * Alexa: 12 divided by 3 is 4  
 
## How to set up the skill.
This sample uses alexa-sdk for Node.js and can run on AWS lambda function.
About the sdk and the instllation instruction for the skills uses the sdk, please see:
https://github.com/alexa/alexa-skills-kit-sdk-for-nodejs

## Note:
Using the standard feature of the SDK, this skill uses dynamoDB for the persistent strage.  
To make the feature available, you have to have permission for the role set to the lambda function.
To modify the permission for a role, you have have to visit AWS console's IAM role setting:

https://console.aws.amazon.com/iam/home#/roles

## Lisence
This sample code is provided unser Apache License Version 2.0. For detail, please see: https://github.com/takujikawata/calculator-skill-sample/blob/master/LICENSE.txt

