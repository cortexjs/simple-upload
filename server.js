var express = require('express');
var multer  = require('multer');
var config = require('config');
var fs = require('fs');
var zlib = require('zlib');
var fstream = require('fstream');
var tar = require('tar');
var mkdirp = require('mkdirp');
var path = require('path');
var Domain = require('domain');
var tracer = require('tracer');
var logger = require('tracer').console();

var app = express();

app.use(multer());
app.post("/", function(req,res,next){
  var remote = req.body.remote || ".";
  var root = config.get('root');

  var files = req.files;
  if(!files || !files.file){
    return next();
  }

  if(~remote.indexOf("..")){
    return next();
  }

  var file = files.file;
  var filepath = file.path;
  var rootpath = path.join(root, remote);

  logger.log("recives %j",file);
  var domain = Domain.create();

  domain.on('error', function (error) {
    next(error);
  });

  domain.run(function () {
    mkdirp(rootpath, function(err){
      if(err){return next(err);}
      fstream.Reader({
        path: filepath,
        type: 'File'
      })
      .pipe(zlib.Unzip())
      .pipe(tar.Extract({
        path: rootpath
      }))
      .on('end', function() {
        fs.unlink(filepath, function(err){
          if(err){return next(err)}
          res.status(200).send("ok");
        });
      })
      .on('error', next);
    });
  });
});

app.use(function(req,res){
  res.status(400).send("bad request");
});

app.listen(config.get('port'),function(){
  console.log("simple upload server started at " + config.get("port"));
});