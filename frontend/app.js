const API_URL = ''; // Change to your backend URL if needed
let token = localStorage.getItem('token') || '';
let currentUser = null;
let allPosts = [];

function showRegister() {
    document.getElementById('auth').style.display = 'none';
    document.getElementById('register').style.display = 'block';
}
function hideRegister() {
    document.getElementById('auth').style.display = 'block';
    document.getElementById('register').style.display = 'none';
}
function showCreatePost() {
    document.getElementById('create-post').style.display = 'block';
}
function hideCreatePost() {
    document.getElementById('create-post').style.display = 'none';
}
function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    fetch(API_URL + '/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    })
    .then(res => res.json())
    .then(data => {
        if (data.access_token) {
            token = data.access_token;
            localStorage.setItem('token', token);
            getCurrentUser();
        } else {
            alert('Login failed');
        }
    });
}
function register() {
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const full_name = document.getElementById('reg-fullname').value;
    fetch(API_URL + '/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, full_name })
    })
    .then(res => res.json())
    .then(data => {
        if (data.username) {
            alert('Registration successful! Please login.');
            hideRegister();
        } else {
            alert('Registration failed');
        }
    });
}
function logout() {
    token = '';
    localStorage.removeItem('token');
    currentUser = null;
    document.getElementById('user-panel').style.display = 'none';
    document.getElementById('auth').style.display = 'block';
    loadPosts();
}
function getCurrentUser() {
    fetch(API_URL + '/users/me', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(res => res.json())
    .then(user => {
        if (user.username) {
            currentUser = user;
            document.getElementById('auth').style.display = 'none';
            document.getElementById('register').style.display = 'none';
            document.getElementById('user-panel').style.display = 'block';
            document.getElementById('welcome').innerText = `Welcome, ${user.username} (${user.role})`;
            loadPosts();
        } else {
            alert('Failed to fetch user info');
        }
    });
}
function createPost() {
    const title = document.getElementById('post-title').value;
    const content = document.getElementById('post-content').value;
    fetch(API_URL + '/posts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ title, content })
    })
    .then(res => res.json())
    .then(post => {
        if (post.title) {
            hideCreatePost();
            loadPosts();
        } else {
            alert('Failed to create post');
        }
    });
}

// Add comment to a post
function addComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();
    if (!content) return;
    fetch(`${API_URL}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ content })
    })
    .then(res => res.json())
    .then(comment => {
        input.value = '';
        loadComments(postId);
    });
}

// Load comments for a post
function loadComments(postId) {
    fetch(`${API_URL}/posts/${postId}/comments`)
    .then(res => res.json())
    .then(comments => {
        const commentsDiv = document.getElementById(`comments-${postId}`);
        if (!commentsDiv) return;
        commentsDiv.innerHTML = '';
        comments.forEach(comment => {
            const div = document.createElement('div');
            div.className = 'comment';
            div.innerHTML = `<span class='comment-author'>${comment.author}</span><span class='comment-content'>${comment.content}</span> <span style='color:#aaa;font-size:0.9em;'>${new Date(comment.created_at).toLocaleString()}</span>`;
            commentsDiv.appendChild(div);
        });
    });
}

function likePost(postId) {
    fetch(`${API_URL}/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(() => loadPosts());
}

function unlikePost(postId) {
    fetch(`${API_URL}/posts/${postId}/unlike`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(() => loadPosts());
}

function searchPosts() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = allPosts.filter(post =>
        post.title.toLowerCase().includes(query) ||
        post.content.toLowerCase().includes(query)
    );
    renderPosts(filtered);
}

function loadPosts() {
    fetch(API_URL + '/posts')
    .then(res => res.json())
    .then(posts => {
        allPosts = posts;
        renderPosts(posts);
    });
}

function renderPosts(posts) {
    const postsDiv = document.getElementById('posts');
    postsDiv.innerHTML = '';
    posts.forEach(post => {
        const liked = post.liked_by && currentUser && post.liked_by.includes(currentUser.username);
        const likeIcon = liked
            ? `<span title='Unlike' style='color:#e0245e;cursor:pointer;font-size:1.3em;' onclick='unlikePost("${post.id}")'>&#10084;&#65039;</span>`
            : `<span title='Like' style='color:#bbb;cursor:pointer;font-size:1.3em;' onclick='likePost("${post.id}")'>&#9825;</span>`;
        const likeCount = `<span style='margin-left:6px;color:#e0245e;font-weight:600;'>${post.likes || 0}</span>`;
        const likeRow = token ? `<div class='like-row'>${likeIcon} ${likeCount}</div>` : `<div class='like-row' style='color:#e0245e;font-weight:600;'>❤️ ${post.likes || 0}</div>`;
        const div = document.createElement('div');
        div.className = 'post';
        div.innerHTML = `<div class='post-title'>${post.title}</div>
            <div class='post-meta'>By ${post.author} | ${new Date(post.created_at).toLocaleString()}</div>
            ${likeRow}
            <div class='post-content'>${post.content}</div>
            <div class='comments-section' id='comments-${post.id}'></div>
            ${token ? `<div class='add-comment-row'><input id='comment-input-${post.id}' type='text' placeholder='Add a comment...'><button onclick='addComment("${post.id}")'>Post</button></div>` : ''}`;
        postsDiv.appendChild(div);
        loadComments(post.id);
    });
}
window.onload = function() {
    token = localStorage.getItem('token') || '';
    if (token) {
        getCurrentUser();
    } else {
        loadPosts();
    }
};
