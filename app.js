const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)
const flash = require('connect-flash')
const markdown = require('marked')
const csrf = require('csurf')
const app = express()
const sanitizeHTML = require('sanitize-html')

app.use(express.urlencoded({extended: false}))
app.use(express.json())

app.use('/api', require('./router-api'))

let sessionOptions = session({
    secret: process.env.SESSIONSECRET,
    store: new MongoStore({client: require('./db')}),
    resave: false,
    saveUninitialized: false,
    cookie: {maxAge: 1000 * 60 * 60 * 24, httpOnly: true}
})

app.use(sessionOptions)
app.use(flash())

// Runs for every request, middleware
app.use((req, res, next) => {
    // make our markdown function available from within ejs templates
    res.locals.filterUserHTML = function(content) {
        return sanitizeHTML(markdown(content), {allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'bold', 'i', 'em', 'h1'], allowedAttributes: []})
    }
    // make error and success flash messages available for all templates
    res.locals.errors = req.flash("errors")
    res.locals.success = req.flash("success")
    // make current user id available on the req object
    if(req.session.user) {req.visitorId = req.session.user._id} else{req.visitorId = 0}
    // locals available from within templates as user.<attribute>
    res.locals.user = req.session.user
    next()
})

const router = require('./router.js')

app.use(express.static('public'))
app.set('views', 'views')
app.set('view engine', 'ejs')

app.use(csrf())

app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken()
    next()
})

app.use('/', router)

app.use((err, req, res, next) => {
    if(err) {
        if(err.code == "EBADCSRFTOKEN") {
            req.flash('errors', "Cross site request forgery detected.")
            req.session.save(() => res.redirect('/'))
        } else {
            res.render('404')
        }
    }
})

// server that will use express app as it's handler, package included in node by default
const server = require('http').createServer(app)

const io = require('socket.io')(server)

io.use((socket, next) => {
    // gives socket acess to session data
    sessionOptions(socket.request, socket.request.res, next)
})

io.on('connection', (socket) => {
    if(socket.request.session.user) {
        let user = socket.request.session.user

        socket.emit('welcome', {username: user.username, avatar: user.avatar})

        socket.on('chatMessageFromBrowser', (data) => {
            socket.broadcast.emit('chatMessageFromServer', {message: sanitizeHTML(data.message, {allowedTags: [], allowedAttributes: []}), username: user.username, avatar: user.avatar})
        })
    }
})

module.exports = server