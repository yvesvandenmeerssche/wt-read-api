/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
const { expect } = require('chai')
const fetch = require('node-fetch')
const config = require('../config.js')
const utils = require('../wt-js-libs/libs/utils/index')
const { app } = require('../src/srv/service')
const lifData = require('./lifContract')
const gasMargin = 1.5
const addressZero = '0x0000000000000000000000000000000000000000000000000000000000000000'
let index
let fundingSource
let daoAccount
let ownerAccount
let server

const Before = () => (
  before(async function () {
    config.set('password', 'test123')
    config.set('web3Provider', 'http://localhost:8545')
    config.updateWeb3Provider()
    config.set('privateKeyDir', 'keys/test.json')
    const wallet = await config.get('web3').eth.accounts.wallet.create(3)
    const accounts = await config.get('web3').eth.getAccounts()
    fundingSource = accounts[0]
    ownerAccount = wallet['0'].address
    daoAccount = wallet['1'].address
    config.set('user', wallet['2'].address)
    await utils.fundAccount(fundingSource, ownerAccount, '50', config.get('web3'))
    await utils.fundAccount(fundingSource, daoAccount, '50', config.get('web3'))
    await utils.fundAccount(fundingSource, config.get('user'), '50', config.get('web3'))
  })
)
const BeforeEach = () => (
  beforeEach(async function () {
    index = await utils.deployIndex({
      owner: daoAccount,
      gasMargin: gasMargin,
      web3: config.get('web3')
    })
    expect(index._address).to.not.equal(addressZero)
    config.set('indexAddress', index._address)
    server = await app.listen(3000)
    await setUpWallet()
    await generateHotel(daoAccount)
    await deployLifContract(daoAccount, config.get('user'), index)
  })
)
const AfterEach = () => (
  afterEach(async function () {
    return server.close()
  })
)

async function generateHotel (ownerAddres) {
  let body
  let res
  let hotelAddresses
  const hotelName = 'Test Hotel'
  const hotelDesc = 'Test Hotel desccription'
  const unitTypeName = 'TYPE_000'
  const amenity = 5
  const imageUrl = 'test-image.jpeg'
  const defaultPrice = 78
  const defaultLifPrice = 2

  body = JSON.stringify({
    'password': config.get('password'),
    'description': hotelDesc,
    'name': hotelName
  })
  await fetch('http://localhost:3000/hotels', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body
  })

  body = JSON.stringify({
    'password': config.get('password')
  })
  res = await fetch('http://localhost:3000/hotels', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    },
    body
  })

  hotelAddresses = Object.keys(await res.json())
  config.set('testAddress', hotelAddresses[0])
  body = JSON.stringify({
    'password': config.get('password'),
    type: unitTypeName
  })
  res = await fetch(`http://localhost:3000/hotels/${hotelAddresses[0]}/unitTypes`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body
  })

  body = JSON.stringify({
    'password': config.get('password'),
    amenity
  })
  res = await fetch(`http://localhost:3000/hotels/${config.get('testAddress')}/unitTypes/${unitTypeName}/amenities`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body
  })

  body = JSON.stringify({
    'password': config.get('password')
  })
  res = await fetch(`http://localhost:3000/hotels/${config.get('testAddress')}/unitTypes/${unitTypeName}/units`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body
  })

  body = JSON.stringify({
    'password': config.get('password'),
    'url': imageUrl
  })
  res = await fetch(`http://localhost:3000/hotels/${config.get('testAddress')}/unitTypes/${unitTypeName}/images`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body
  })
  res = await fetch('http://localhost:3000/hotels', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    },
    body
  })
  const hotels = await res.json()
  hotelAddresses = Object.keys(hotels)
  const hotel = hotels[hotelAddresses[0]]
  let unitAddresses = Object.keys(hotel.units)
  expect(hotel).to.have.property('name', hotelName)
  expect(hotel).to.have.property('description', hotelDesc)
  expect(hotel).to.have.property('unitTypeNames')
  expect(hotel.unitTypeNames).to.include(unitTypeName)
  expect(hotel.unitTypes[unitTypeName].amenities).to.include(amenity)
  const unitAdress = hotel.unitAddresses[unitAddresses.length - 1]
  config.set('unitAdress', unitAdress)
  expect(hotel.units[unitAdress]).to.have.property('unitType', unitTypeName)
  expect(hotel.unitTypes[unitTypeName].images).to.include(imageUrl)

  body = JSON.stringify({
    password: config.get('password'),
    price: defaultPrice
  })
  res = await fetch(`http://localhost:3000/hotels/${config.get('testAddress')}/units/${config.get('unitAdress')}/defaultPrice`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body
  })
  body = JSON.stringify({
    password: config.get('password'),
    price: defaultLifPrice
  })

  res = await fetch(`http://localhost:3000/hotels/${config.get('testAddress')}/units/${config.get('unitAdress')}/defaultLifPrice`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body
  })
}

async function setUpWallet () {
  const wallet = await config.get('web3').eth.accounts.wallet[0].encrypt(config.get('password'))
  const body = JSON.stringify({
    'password': config.get('password'),
    wallet
  })
  await fetch('http://localhost:3000/wallet', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body
  })
}

async function deployLifContract (deployerAccount, user) {
  const web3 = config.get('web3')
  const lifContract = new web3.eth.Contract(lifData.abi)
  const resp = await lifContract.deploy({
    data: lifData.byteCode,
    arguments: []
  }).send({
    from: deployerAccount,
    gas: 5000000,
    gasPrice: 1
  })
  lifContract.options.address = resp.contractAddress
  config.set('tokenAddress', resp.contractAddress)
  await lifContract.methods.faucetLif().send({from: user, gas: 6000000})
  const balance = await lifContract.methods.balanceOf(user).call({from: user})
  expect(balance).to.eql('50000000000000000000')

  const setLifData = await index.methods
    .setLifToken(lifContract.options.address)
    .encodeABI()

  const setLifOptions = {
    from: deployerAccount,
    to: index.options.address,
    gas: 5000000,
    data: setLifData
  }

  await web3.eth.sendTransaction(setLifOptions)
}

module.exports = {
  AfterEach,
  BeforeEach,
  Before
}
