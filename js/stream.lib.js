function readSponge(stream, callback){
 var contents = [];
 stream.addListener(
  "data",
  function capture(chunk){
   contents.push(chunk);
  }
 );
 stream.addListener(
  "end",
  function callIt(){
   return callback(contents.join(""));
  }
 ); 
}

this.readSponge = readSponge;
