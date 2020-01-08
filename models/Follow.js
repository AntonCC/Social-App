const usersCollection = require('../db').db().collection('users')
const followsCollection = require('../db').db().collection('follows')
const User = require('./User')
const ObjectID = require('mongodb').ObjectID

let Follow = function(followedUsername, authorId) {
    this.followedUsername = followedUsername
    this.authorId = authorId
    this.errors = []
}

Follow.prototype.cleanUp = function() {
    if(typeof(this.followedUsername) != 'string') {this.followedUsername = ''}
}

Follow.prototype.validate = async function(action) {
    // followed username must exist in database
    let followedAccount = await usersCollection.findOne({username: this.followedUsername})
    if(followedAccount) {
        // store database info using _id, username can change
        this.followedId = followedAccount._id
    } else {
        this.errors.push("You cannot follow a user that does not exist.")
    }

    if(this.followedId.equals(this.authorId)) {
        this.errors.push("You cannot follow yourself.")
    }

    let doesFollowExist = await followsCollection.findOne({followedId: this.followedId, authorId: new ObjectID(this.authorId)})
    if(action == "create") {
        if(doesFollowExist) {
            this.errors.push("You are already following this user.")
        }
    } else if(action == "delete") {
        if(!doesFollowExist) {
            this.errors.push("Cannot delete follow that doesn't exist.")
        }
    }
}

Follow.prototype.create = function() {
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        await this.validate("create")
        if(!this.errors.length) {
            await followsCollection.insertOne({followedId: this.followedId, authorId: new ObjectID(this.authorId)})
            resolve()
        } else {
            reject(this.errors)
        }
    })
}

Follow.prototype.delete = function() {
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        await this.validate("delete")
        if(!this.errors.length) {
            await followsCollection.deleteOne({followedId: this.followedId, authorId: new ObjectID(this.authorId)})
            resolve()
        } else {
            reject(this.errors)
        }
    })
}

Follow.isVisitorFollowing = async function(followedId, visitorId) {
    let followDoc = await followsCollection.findOne({followedId: followedId, authorId: new ObjectID(visitorId)})
    if(followDoc) {
        return true
    } else {
        return false
    }
}

Follow.getFollowersById = function(id) {
    return new Promise(async (resolve, reject) => {
        try {
            let follows = await followsCollection.aggregate([
                {$match: {followedId: id}},
                {$lookup: {from: "users", localField: "authorId", foreignField: "_id", as: "userDoc"}},
                {$project: {
                    username: {$arrayElemAt: ["$userDoc.username", 0]},
                    email: {$arrayElemAt: ["$userDoc.email", 0]}
                }}
            ]).toArray()
            follows = follows.map((follower) => {
                let user = new User(follower, true)
                return {username: follower.username, avatar: user.avatar}
            })
            resolve(follows)
        } catch {
            reject()
        }
    })
}

Follow.getFollowingById = function(id) {
    return new Promise(async (resolve, reject) => {
        try {
            let follows = await followsCollection.aggregate([
                {$match: {authorId: id}},
                {$lookup: {from: "users", localField: "followedId", foreignField: "_id", as: "userDoc"}},
                {$project: {
                    username: {$arrayElemAt: ["$userDoc.username", 0]},
                    email: {$arrayElemAt: ["$userDoc.email", 0]}
                }}
            ]).toArray()
            follows = follows.map((follower) => {
                let user = new User(follower, true)
                return {username: follower.username, avatar: user.avatar}
            })
            resolve(follows)
        } catch {
            reject()
        }
    })
}

Follow.countFollowersById = function(id) {
    return new Promise(async (resolve, reject) => {
        let followerCount = await followsCollection.countDocuments({followedId: id})
        resolve(followerCount)
    })
}

Follow.countFollowingById = function(id) {
    return new Promise(async (resolve, reject) => {
        let followingCount = await followsCollection.countDocuments({authorId: id})
        resolve(followingCount)
    })
}

module.exports = Follow

