const API_URL = ''; // Change to your backend URL if needed
let token = '';
let currentUser = null;

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
function loadPosts() {
    fetch(API_URL + '/posts')
    .then(res => res.json())
    .then(posts => {
        const postsDiv = document.getElementById('posts');
        postsDiv.innerHTML = '';
        posts.forEach(post => {
            const div = document.createElement('div');
            div.className = 'post';
            div.innerHTML = `<div class='post-title'>${post.title}</div>
                <div class='post-meta'>By ${post.author} | ${new Date(post.created_at).toLocaleString()}</div>
                <div>${post.content}</div>`;
            postsDiv.appendChild(div);
        });
    });
}
window.onload = function() {
    loadPosts();
};
