import axios from 'axios'
import DOMPurify from 'dompurify'

export default class Search {
    // 1. Select DOM elements, keep track of useful data
    constructor() {
        this._csrf = document.querySelector('[name="_csrf"]').value
        this.injectHTML()
        this.headerSearchIcon = document.querySelector(".header-search-icon")
        this.overlay = document.querySelector(".search-overlay")
        this.closeIcon = document.querySelector(".close-live-search")
        this.inputField = document.querySelector("#live-search-field")
        this.resultsArea = document.querySelector(".live-search-results")
        this.loaderIcon = document.querySelector(".circle-loader")
        this.typingWaitTimer
        this.previousValue = ""
        this.events()
    }

    // 2. Events
    events() {
        this.headerSearchIcon.addEventListener("click", (e) => {
            e.preventDefault()
            this.openOverlay()
        })
        this.closeIcon.addEventListener("click", () => {
            this.closeOverlay()
            this.inputField.value = ""
        })
        this.inputField.addEventListener("keyup", () => this.keyPressHandler())
    }
    // 3. Methods
    openOverlay() {
        this.overlay.classList.add("search-overlay--visible")
        setTimeout(() => this.inputField.focus(), 50)
    }

    closeOverlay() {
        this.overlay.classList.remove("search-overlay--visible")
        this.removeLoaderIcon()
    }

    keyPressHandler() {
      let value = this.inputField.value

      if(value == "") {
        clearTimeout(this.typingWaitTimer)
        this.removeLoaderIcon()
        this.removeResultsArea()
      }

      if(value != this.previousValue && value != "") {
        clearTimeout(this.typingWaitTimer)
        this.showLoaderIcon()
        this.removeResultsArea()
        this.previousValue = value
        this.typingWaitTimer = setTimeout(() => this.sendRequest(), 750)
      } else {
        return
      }
    }

    sendRequest() {
      // browser side requests using axios
      axios.post('/search', {searchTerm: this.inputField.value, _csrf: this._csrf})
      .then((response) => {
        console.log(response.data)
        this.renderResultsHTML(response.data)
      })
      .catch(() => {
        console.log("Failed.")
      })
    }

    renderResultsHTML(posts) {
      if(posts.length) {
        this.resultsArea.innerHTML = DOMPurify.sanitize(`<div class="list-group shadow-sm">
        <div class="list-group-item active"><strong>Search Results</strong> (${posts.length > 1 ? `${posts.length} items found` : "1 item found"})</div>
        ${posts.map((post) => {
          let postDate = new Date(post.createdDate)
          return `<a href="/post/${post._id}" class="list-group-item list-group-item-action">
          <img class="avatar-tiny" src="${post.author.avatar}"> <strong>${post.title}</strong>
          <span class="text-muted small">by ${post.author.username} on ${postDate.getMonth() + 1}/${postDate.getDate()}/${postDate.getFullYear()}</span>
        </a>`
        }).join('')}
      </div>`)
      } else {
        this.resultsArea.innerHTML = `<p class="alert alert-danger text-center shadow-sm">Sorry, no results were found for that search.</p>`
      }
      this.removeLoaderIcon()
      this.showResultsArea()
    }

    showResultsArea() {
      this.resultsArea.classList.add("live-search-results--visible")
    }

    removeResultsArea() {
      this.resultsArea.classList.remove("live-search-results--visible")
    }

    showLoaderIcon() {
      this.loaderIcon.classList.add("circle-loader--visible")
    }

    removeLoaderIcon() {
      this.loaderIcon.classList.remove("circle-loader--visible")
    }

    injectHTML() {
        document.body.insertAdjacentHTML('beforeend', `<!-- search feature begins -->
        <div class="search-overlay">
          <div class="search-overlay-top shadow-sm">
            <div class="container container--narrow">
              <label for="live-search-field" class="search-overlay-icon"><i class="fas fa-search"></i></label>
              <input type="text" id="live-search-field" class="live-search-field" placeholder="What are you interested in?">
              <span class="close-live-search"><i class="fas fa-times-circle"></i></span>
            </div>
          </div>
      
          <div class="search-overlay-bottom">
            <div class="container container--narrow py-3">
              <div class="circle-loader"></div>
              <div class="live-search-results"></div>
            </div>
          </div>
        </div>
        <!-- search feature end -->`)
    }
}