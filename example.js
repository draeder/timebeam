const Timebeam = require('timebeam')

let timebeam = new Timebeam({
  secret: 'some super secret secret', 
  topic: 'some secure topic identifier',
  serverPort: 22,
  clientPort: 8041
})

timebeam.on('connected', (timebeam)=>{
  console.log('Timebeam Connected!')
})
timebeam.on('close', ()=>{
  console.log('Timebeam closed')
})
timebeam.on('data', data => {
  console.log(data)
})

// Simple terminal chat app
process.stdout.on('data', data => {
  timebeam.send(data)
})

// Telnet to the client port to send messages to the server
// Telnet to the server port to send messages to the client

