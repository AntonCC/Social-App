const postsCollection = require('../db').db().collection("posts")
const followsCollection = require('../db').db().collection("follows")
const User = require('./User')
const ObjectID = require('mongodb').ObjectID
const sanitizeHTML = require('sanitize-html')

let Post = function(data, userid, requestedPostId) {
    this.data = data
    this.userid = userid
    this.requestedPostId = requestedPostId
    this.errors = []
}


Post.prototype.cleanUp = function() {
    if(typeof(this.data.title) != "string") {this.data.title = ""}
    if(typeof(this.data.body) != "string") {this.data.body = ""}

    // get rid of unwanted properties
    this.data = {
        title: sanitizeHTML(this.data.title.trim(), {allowedTags: [], allowedAttributes: []}),
        body: sanitizeHTML(this.data.body.trim(), {allowedTags: [], allowedAttributes: []}),
        createdDate: new Date(),
        author: ObjectID(this.userid)
    }
}

Post.prototype.validate = function() {
    if(this.data.title == "") {this.errors.push("You need to provide a title.")}
    if(this.data.body == "") {this.errors.push("You must provide post content.")}
}

Post.prototype.create = function() {
    return new Promise((resolve, reject) => {
        this.cleanUp()
        this.validate()
        if(!this.errors.length) {
            postsCollection.insertOne(this.data)
            .then(() => {resolve(this.data._id)})
            .catch(() => {this.errors.push("Please try again later"); reject(this.errors)})
        } else {
            reject(this.errors)
        }
    })
}

Post.prototype.update = function() {
    return new Promise(async (resolve, reject) => {
        try {
            let post = await Post.findSingleById(this.requestedPostId, this.userid)
            if(post.isVisitorOwner) {
                let status = await this.actuallyUpdate()
                resolve(status)
            } else {
                reject()
            }
        } catch {
            reject()
        }
    })
}

Post.prototype.actuallyUpdate = function() {
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        this.validate()
        if(!this.errors.length) {
            await postsCollection.findOneAndUpdate({_id: new ObjectID(this.requestedPostId)}, {$set: {title: this.data.title, body: this.data.body}})
            resolve("success")
        } else {
            resolve("faliure")
        }
    })
}

// not creating new object, not calling constructor, calling this function instead
Post.reuseablePostQuery = function(uniqueOperations, visitorId) {
    return new Promise(async (resolve, reject) => {
        let aggOperations = uniqueOperations.concat([
            {$lookup: {from: "users", localField: "author", foreignField: "_id", as: "authorDocument"}},
            {$project: {
                title: 1,
                body: 1,
                createdDate: 1,
                authorId: "$author",
                author: {$arrayElemAt: ["$authorDocument", 0]}
            }}
        ])
        
        let posts = await postsCollection.aggregate(aggOperations).toArray() 

        // clean up author property in each post object
        posts = posts.map((post) => {
            // new attributes for post
            post.isVisitorOwner = post.authorId.equals(visitorId)
            // So authorId dosent show when post sent to front end
            post.authorId = undefined
            post.author = {
                username: post.author.username,
                avatar: new User(post.author, true).avatar
            }
            return post
        })
        resolve(posts)
    })
}

Post.findSingleById = function(id, visitorId) {
    return new Promise(async (resolve, reject) => {
        if(typeof(id) != "string" || !ObjectID.isValid(id)) {
            reject()
            return
        }
        let posts = await Post.reuseablePostQuery([{$match: {_id: new ObjectID(id)}}], visitorId)

        if(posts.length) {
            resolve(posts[0])
        } else {
            reject()
        }
    })
}

Post.findByAuthorId = function(authorId) {
    // ok with returning nothing if no posts found. sort by descending
    return Post.reuseablePostQuery([{$match: {author: authorId}}, {$sort: {createdDate: -1}}])
}

Post.delete = function(toDeleteId, currentUserId) {
    return new Promise(async (resolve,reject) => {
        try {
            let post = await Post.findSingleById(toDeleteId, currentUserId)
            if(post.isVisitorOwner) {
                await postsCollection.deleteOne({_id: new ObjectID(toDeleteId)})
                resolve()
            } else {
                reject()
            }
        } catch {
            reject()
        }
    })
}

Post.search = function(searchTerm) {
    return new Promise(async (resolve, reject) => {
        if(typeof(searchTerm) == 'string') {
            let posts = await Post.reuseablePostQuery([
                {$match: {$text:{$search: searchTerm}}},
                {$sort: {score: {$meta: "textScore"}}}
            ])
            resolve(posts)
        } else {
            reject()
        }
    })
}

Post.countPostsByAuthor = function(id) {
    return new Promise(async (resolve, reject) => {
        let postCount = await postsCollection.countDocuments({author: id})
        resolve(postCount)
    })
}

Post.getFeed = async function(id) {
    let followedUsers = await followsCollection.find({authorId: new ObjectID(id)}).toArray()
    // instead of array of objects map creates an array of ids
    followedUsers = followedUsers.map((followDoc) => {
        return followDoc.followedId
    })

    return Post.reuseablePostQuery([
        {$match: {author: {$in: followedUsers}}},
        {$sort: {createdDate: -1}}
    ])
}

module.exports = Post