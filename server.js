const EventEmitter = require('events').EventEmitter
const base32 = require('hi-base32')
const Hyperbeam = require('hyperbeam')
const { authenticator } = require('@otplib/preset-default')
const crypto = require('crypto')
const Hyperswarm = require('hyperswarm')
const net = require('net')

const Timebeam = function(opts){
  const timebeam = this
  const events = new EventEmitter()
  timebeam.send = {}
  timebeam.emit = events.emit.bind(events)
  timebeam.on = events.on.bind(events)
  let secret = opts && opts.secret ? base32.encode(opts.secret) : authenticator.generateSecret()
  let swarmTopic = crypto.createHash('sha256').update(opts.topic).digest()
  let key
  if(opts.key) key = opts.key

  let swarm = new Hyperswarm({
    ephemeral: false, 
    maxPeers: 1,
    maxServerSockets: 1,
    maxClientSockets: 1
  })
  let beam
  let server = {}
  let peerCount = 0
  swarm.on('connection', (conn, info) => {
    if(peerCount > 1){
      swarm.leave()
      swarm.destroy()
      conn.destroy()
      return
    }
    peerCount++
    if(!info.client){
      peerCount--
      timebeam.emit('beamReady')
      conn.write(beam.key)
      if(opts.serverPort && !info.client){
        server['server'] = net.createServer()
        server['server'].listen(opts.serverPort, () => {
          console.log('Timebeam listening on port', opts.serverPort)
        })
      }
    }
    conn.on('data', data => {
      setTimeout(()=>{
        peerCount--
        timebeam.emit('beamReady', data.toString())
        if(opts.clientPort && info.client){
          server['client'] = net.createServer()
          server['client'].listen(opts.clientPort, () => {
            console.log('Timebeam listening on port', opts.clientPort)
          })
        }
      },1000)
    })
  })
  swarm.join(swarmTopic)
  let beamCount = 0
  timebeam.on('beamReady', (topic) => {
    beam = new Hyperbeam(topic ? topic : undefined)
    beam.on('connected', ()=> {
      swarm.leave(swarmTopic)
      swarm.destroy()
      timebeam.emit('connected', timebeam)
      beamCount++
      if(server['server']){
        server['server'].on('connection', socket => {
          console.log('Got a connection!')
          socket.on('data', data => {
            //console.log(data)
            beam.write(data)
          })
        })
      }
      if(server['client']){
        server['client'].on('connection', socket => {
          console.log('Got a connection!')
          socket.on('data', data => {
            //console.log(data)
            beam.write(data)
          })
        })
      }
    })
    beam.on('close', ()=>{
      console.log('Disconnected')
      beam.destroy()
    })
    beam.on('data', data => {
      try{
        data = JSON.parse(data)
        //if(data.data.ack) return
      } catch {
        timebeam.emit('data', data.toString().trim())
      }
    })
    timebeam.send = data => {
      //data = JSON.stringify({"passcode": "${authenticator.generate(secret)}", "data": "${data.toString()"})
      //Buffer.from(`{"passcode": "${authenticator.generate(secret)}", "data": "${data.toString()}"`)
      beam.write(data)
    }
    setInterval(()=>{
      let now = JSON.stringify({ack: new Date().getTime()})
      timebeam.send(now)
    },1000)
  })

  process.on('uncaughtException', function (err) {
    if(err.code === ('EPIPE' || 'ECONNRESET')) {
      peerCount--
      beamCount--
      if(peerCount === 0){
        swarm.leave(swarmTopic)
        swarm.destroy()
        //beam.leave()
        beam.destroy()
      }
      return
    }
    console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
    console.error(err.stack)
    process.exit(1)
  })

  process.on('SIGINT', ()=>{
    setTimeout(()=>{
      swarm.leave(swarmTopic)
      swarm.destroy()
      process.exit(1)
    }, 1)
  })

}
module.exports = Timebeam
