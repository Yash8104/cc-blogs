# Blog Website Backend (FastAPI + MongoDB)

This is the backend for a blog website with admin and user roles, built using FastAPI and MongoDB (cloud-hosted, e.g., MongoDB Atlas).

## Features
- User authentication (JWT)
- Role-based access (admin/user)
- Blog post CRUD
- Admin can manage all posts and users
- Users can manage their own posts

## Setup
1. Create a MongoDB Atlas cluster and get your connection string.
2. Copy `.env.example` to `.env` and fill in your MongoDB URI and secret key.
3. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
4. Run the server:
   ```sh
   uvicorn main:app --reload
   ```

## API Docs
Visit `/docs` after running the server for interactive API documentation.
