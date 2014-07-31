#!/usr/bin/env node

'use strict';

var argv = require('minimist')(process.argv.slice(2));
var async = require('async');
var temp = require('temp');
var path = require('path');
var fs = require('fs');
var fstream = require('fstream');
var tar = require('tar');
var restler = require('restler');
var zlib = require('zlib');
var dir = argv.dir;
var server = argv.server;
require('colors');

var remote = argv.remote || ".";

if(!dir){
  die("please specify --dir");
}

if(!server){
  die("please specify --server");
}

function die(message){
  console.log(message);
  process.exit(1);
}

function zip(dir, done){
  var filepath = temp.path({suffix:".zip"});
  dir = path.resolve(dir);

  console.log("packing".cyan,dir);
  fstream.Reader({
    path: dir,
    type: 'Directory'
  })
  .pipe(tar.Pack())
  .pipe(
    zlib.createGzip({
      level: 6,
      memLevel: 6
    })
  )
  .pipe(fstream.Writer(filepath))
  .on('close', function(){
    done(null, filepath);
  });
}

function upload(zippath, done){
  console.log("uploading".cyan,zippath);
  fs.stat(zippath, function(err, stats){
    if(err){return done(err);}
    restler.post(server, {
        multipart: true,
        data: {
          "remote": remote,
          "file": restler.file(zippath, null, stats.size, null, "application/zip")
        }
    }).on("success", function(data) {
      fs.unlink(zippath, function(err){
        if(err){return done(err);}
        done(null, data);
      });
    }).on("fail", function(data, response){
      done(data);
    }).on("error", done);
  });
}

async.waterfall([
  function(done){
    zip(dir, done);
  },
  function(zippath, done){
    upload(zippath, done);
  }
], function(err, response_body){
  if(err){return console.log(err.red);}
  console.log(response_body.green);
});