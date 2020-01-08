const dotenv = require('dotenv')
dotenv.config()
const mongodb = require('mongodb')

mongodb.connect(process.env.CONNECTIONSTRINGPROD, {useNewUrlParser: true, useUnifiedTopology: true}, (err, client) => {
   module.exports = client
   const app = require('./app')
   app.listen(process.env.PORT)
})