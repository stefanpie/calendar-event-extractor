const { Configuration, OpenAIApi } = require("openai");
const Mustache = require("mustache");
const fs = require("fs");
const cors = require("cors");
const express = require("express");

require("dotenv").config();

const openai_configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(openai_configuration);

var prompt_template;
try {
  const data = fs.readFileSync("./prompt_template.mustache", "utf8");
  prompt_template = data;
} catch (err) {
  console.error(err);
}

// console.log(prompt_template);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/extract-event", (req, res) => {
  data = {
    message:
      "make a post request to this endpoint with the text you want to process",
  };
  res.send(data);
});

app.post("/extract-event", async (req, res) => {
  // check if request is json
  if (!req.is("application/json")) {
    res.status(500).send({
      message: "request must be json",
    });
  }
  // check input has key input_text
  if (!req.body.input_text) {
    res.status(500).send({
      message: "request must have key input_text",
    });
  }

  const input_text = req.body.input_text;
  // check if input_text is a string
  if (typeof input_text !== "string") {
    res.status(500).send({
      message: "input_text must be a string",
    });
  }
  // check if input_text is not an empty string
  if (input_text.length === 0) {
    res.status(500).send({
      message: "input_text cannot be an empty string",
    });
  }

  const prompt = Mustache.render(prompt_template, { input_text: input_text });
  console.log(prompt);

  const openai_response = await openai.createCompletion("text-davinci-003", {
    prompt: prompt,
    max_tokens: 512,
    temperature: 0.7,
    stop: "[END EVENTS OBJECT]",
  });

  choices = openai_response.data.choices;
  console.log(choices);
  // if choices is empty, return error
  var generated_text;
  if (choices.length === 0) {
    res.status(500).send({
      message: "no choices returned",
    });
  }
  // if choices is not empty, return the first choice
  else {
    generated_text = choices[0].text;
  }

  // remove whitespace from the start and end of the generated text
  generated_text = generated_text.trim();
  generated_text = "[" + generated_text;

  console.log(generated_text);

  // parse the generated text into a json object
  var generated_json;
  try {
    generated_json = JSON.parse(generated_text);
  } catch (err) {
    res.status(500).send(
      "generated text is not a valid json object"
    );
  }
  console.log(generated_json);


  
  for (var i = 0; i < generated_json.length; i++) {
    var event = generated_json[i];
    var event_creation_link = "http://www.google.com/calendar/render?";
    event_creation_link += "action=TEMPLATE";
    // event_creation_link += "&text=" + event.event_name;
    // uri encode the event name
    event_creation_link += "&text=" + encodeURIComponent(event.event_name);
    
    // if an event has a start time or an end time, remove the dashes and colens
    var start_datetime = event.start_datetime;
    var end_datetime = event.end_datetime;
    if (start_datetime) {
      start_datetime = start_datetime.replace(/-/g, "");
      start_datetime = start_datetime.replace(/:/g, "");
    }
    if (end_datetime) {
      end_datetime = end_datetime.replace(/-/g, "");
      end_datetime = end_datetime.replace(/:/g, "");
    }
    event_creation_link += "&dates=" + start_datetime + "/" + end_datetime;
    // uri encode the event_creation_link
    generated_json[i].event_creation_link = event_creation_link;
  }

  

  const response = {
    message: "success",
    events: generated_json,
  };

  res.json(response);
});

app.listen(port, () => {});
