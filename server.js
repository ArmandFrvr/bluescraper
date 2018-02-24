var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");

// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
var axios = require("axios");
var cheerio = require("cheerio");

// Require all models
var db = require("./models");

var PORT = 3000;

// Initialize Express
var app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: false }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

// By default mongoose uses callbacks for async queries, we're setting it to use promises (.then syntax) instead
// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect("mongodb://localhost/bluescraper", {
  useMongoClient: true
});

// Routes

// A GET route for scraping the echojs website
app.get("/scrape", function(req, res) {

  // First, we grab the body of the html with request
  axios.get("https://blue.mmo-champion.com/").then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);

    // count number of new articles
    var newArticles = 0;

    // Look at every row in the topic table
    $("#tlist-topics tr").each(function(i, element) {

      // if region flag is US (US articles only)
      if($(this).children("td.topic_title")
                .children("img")
                .attr("src")
                .indexOf("us-en") >= 0
        // and the original post is by a Blizzard employee
        && $(this).children("td.topic_title")
                  .children("a")
                  .hasClass("blue_poster")) {

        // Save an empty result object
        var result = {};

        // Get the stuff we care about
        result.title = $(this)
          .children("td.topic_title")
          .children("a")
          .text();
        result.link = $(this)
          .children("td.topic_title")
          .children("a")
          .attr("href");
        result.date = $(this)
          .children("td.blue_date")
          .text();
        result.author = $(this)
          .children("td:last-child")
          .children("a")
          .text();

        db.Article.findOne({title: result.title})
          .then(function(dbArticle) {
            console.log("Already exists: " + result.title);
            // if result.title not already in db
            if(!dbArticle) {
              newArticles++;
              // Create a new Article using the `result` object built from scraping
              db.Article.create(result)
              .then(function(dbArticle) {
                console.log("Adding: " + result.title);
              })
              .catch(function(err) {
                // If an error occurred, send it to the client
                console.log(err);
              });
            }

          })
          .catch(function(err) {
            console.log(err);
          });

      }
    });

    //  Wasted 3 hours on this nonsense, ghetto delay
    setTimeout(function(){
     res.send("Scraped " + newArticles + " new articles.");
    }, 100);

  });
});

// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
  // TODO: Finish the route so it grabs all of the articles
  db.Article.find({})
  .then(function(dbArticle) {
    res.json(dbArticle);
  })
  .catch(function(err) {
    res.json(err);
  });
});

// Route for grabbing a specific Article by id, populate it with its note
app.get("/articles/:id", function(req, res) {
  // TODO
  // ====
  // Finish the route so it finds one article using the req.params.id,
  // and run the populate method with "note",
  // then responds with the article with the note included
  db.Article.findOne({_id: req.params.id})
  .populate("note")
  .then(function(Article) {
    res.json(Article);
  })
  .catch(function(err) {
    res.json(err);
  });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  // TODO
  // ====
  // save the new note that gets posted to the Notes collection
  // then find an article from the req.params.id
  // and update it's "note" property with the _id of the new note
  db.Note.create(req.body)
  .then(function(dbNote) {
    return db.Article.findOneAndUpdate({_id: req.params.id},
      { $set: {note: dbNote._id}}, {new:true});
  })
  .catch(function(err) {
    res.json(err);
  });
});

// Start the server
app.listen(PORT, function() {
  console.log("App running on port " + PORT + "!");
});

// Route for saving a note to your saved notes
app.get("/save/:id", function(req, res) {
  db.Article.findOneAndUpdate({_id: req.params.id},
    { $set: {saved: true}});
});

app.put("/unsave/:id", function(req, res) {
  db.Article.findOneAndUpdate({_id: req.params.id},
    { $set: {saved: false}});
});