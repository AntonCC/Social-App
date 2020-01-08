const bcrypt = require('bcryptjs')
const validator = require('validator')
const md5 = require('md5')
const usersCollection = require('../db').db().collection("users")

let User = function(data, getAvatar) {
    this.data = data
    this.errors = []
    if(getAvatar == undefined) {getAvatar = false}
    if(getAvatar) {this.getAvatar()}
}

User.prototype.cleanUp = function() {
    if(typeof(this.data.username) != "string") {this.data.username = ''}
    if(typeof(this.data.email) != "string") {this.data.email = ''}
    if(typeof(this.data.password) != "string") {this.data.password = ''}

    // Get rid of bad properties
    this.data = {
        username: this.data.username.trim().toLowerCase(),
        email: this.data.email.trim().toLowerCase(),
        password: this.data.password
    }
}

User.prototype.validate = function() {
    if(this.data.username == '') {this.errors.push("You must provide a username.")}
    if(this.data.username != '' && !validator.isAlphanumeric(this.data.username)) {this.errors.push("Username must be alphanumeric.")}
    if(!validator.isEmail(this.data.email)) {this.errors.push("You must provide a valid email address.")}

    if(this.data.password == '') {this.errors.push("You must provide a password.")}
    if(this.data.password.length > 0 && this.data.password.length < 8) {this.errors.push("Password must be at least 8 characters.")}
    if(this.data.password.length > 50) {this.errors.push("Password is too long.")}

    if(this.data.username.length > 0 && this.data.username.length < 3) {this.errors.push("Username must be at least 3 characters.")}
    if(this.data.username.length > 30) {this.errors.push("Username is too long.")}
}

User.prototype.checkUnique = function() {
    return new Promise(async (resolve, reject) => {
        // Only if username is valid, check if unique
        if(this.data.username.length > 2 && this.data.username.length < 31 && validator.isAlphanumeric(this.data.username)) {
            let usernameExists = await usersCollection.findOne({username: this.data.username})
            if(usernameExists) {this.errors.push("That username is not available.")}
        }
        // Only if email is valid, check if unique
        if(validator.isEmail(this.data.email)) {
            let emailExists = await usersCollection.findOne({email: this.data.email})
            if(emailExists) {this.errors.push("That email is already being used.")}
        }
        resolve()
    })
}

User.prototype.login = function() {
    return new Promise((resolve, reject) => {
        this.cleanUp()
        usersCollection.findOne({username: this.data.username})
        .then((attemptedUser) => {
            if(attemptedUser && bcrypt.compareSync(this.data.password, attemptedUser.password)) {
                this.data = attemptedUser
                this.getAvatar()
                resolve("Congrats.")
            } else {
                reject("Invalid username/password.")
            }
        })
        .catch(() => {
            reject("Please try again later.")
        })
    })
}

User.prototype.register = async function() {
    this.cleanUp()
    this.validate()
    await this.checkUnique()

    if(!this.errors.length) {
        // hash user password
        let salt = bcrypt.genSaltSync(10)
        this.data.password = bcrypt.hashSync(this.data.password, salt)
        await usersCollection.insertOne(this.data)
        this.getAvatar()
    }
}

User.prototype.getAvatar = function() {
    this.avatar = `https://gravatar.com/avatar/${md5(this.data.email)}?s=128`
}

User.findByUsername = function (username) {
    return new Promise((resolve, reject) => {
        if(typeof(username) != 'string') {reject(); return}
        usersCollection.findOne({username: username})
        .then((userDoc) => {
            if(userDoc) {
                userDoc = new User(userDoc, true)
                userDoc = {
                    _id: userDoc.data._id,
                    username: userDoc.data.username,
                    avatar: userDoc.avatar
                }
                resolve(userDoc)
            }
            else {reject()}
        })
        .catch(() => {reject()})
    })
}

User.findByEmail = function (email) {
    return new Promise((resolve, reject) => {
        if(typeof(email) != 'string') {reject(); return}
        usersCollection.findOne({email: email})
        .then((userDoc) => {
            if(userDoc) {
                userDoc = new User(userDoc, true)
                userDoc = {
                    _id: userDoc.data._id,
                    username: userDoc.data.username,
                    avatar: userDoc.avatar
                }
                resolve(userDoc)
            }
            else {reject()}
        })
        .catch(() => {reject()})
    })
}

module.exports = User