from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
 # Password hashing removed for testing
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv, find_dotenv
# Force load .env from backend directory
import pathlib

backend_env_path = pathlib.Path(__file__).parent / '.env'
print('Loading .env from:', backend_env_path)
load_dotenv(backend_env_path)

app = FastAPI()

origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (JS, CSS) from the frontend folder
frontend_path = pathlib.Path(__file__).parent.parent / "frontend"
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_file = frontend_path / "index.html"
    return FileResponse(index_file)


MONGODB_URI = os.getenv("MONGODB_URI")
SECRET_KEY = os.getenv("SECRET_KEY")
print("MONGODB_URI:", MONGODB_URI)
print("SECRET_KEY:", SECRET_KEY)

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

client = AsyncIOMotorClient(MONGODB_URI)
db = client.blog

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")

class User(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    disabled: Optional[bool] = False
    role: str = "user"  # 'user' or 'admin'

class UserInDB(User):
    hashed_password: str

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class BlogPost(BaseModel):
    id: Optional[str]
    title: str
    content: str
    author: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class BlogPostCreate(BaseModel):
    title: str
    content: str

class Comment(BaseModel):
    id: Optional[str]
    post_id: str
    author: str
    content: str
    created_at: Optional[datetime] = None

class CommentCreate(BaseModel):
    content: str

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_user(username: str):
    user = await db.users.find_one({"username": username})
    if user:
        return UserInDB(**user)
    return None

async def authenticate_user(username: str, password: str):
    user = await get_user(username)
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
        token_data = TokenData(username=username, role=role)
    except JWTError:
        raise credentials_exception
    user = await get_user(token_data.username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: UserInDB = Depends(get_current_user)):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_admin_user(current_user: UserInDB = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user

# Utility functions (no hashing, plain text only for testing!)
def verify_password(plain_password, stored_password):
    return plain_password == stored_password

def get_password_hash(password):
    return password

@app.post("/register", response_model=User)
async def register(user: UserCreate):
    if await db.users.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username already registered")
    stored_password = get_password_hash(user.password)
    user_dict = user.dict()
    user_dict["hashed_password"] = stored_password
    user_dict["role"] = "user"
    del user_dict["password"]
    await db.users.insert_one(user_dict)
    return User(**user_dict)

@app.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=User)
async def read_users_me(current_user: UserInDB = Depends(get_current_active_user)):
    return current_user

@app.get("/users", response_model=List[User])
async def list_users(admin: UserInDB = Depends(get_admin_user)):
    users = await db.users.find().to_list(100)
    return [User(**u) for u in users]

@app.post("/posts", response_model=BlogPost)
async def create_post(post: BlogPostCreate, user: UserInDB = Depends(get_current_active_user)):
    post_dict = post.dict()
    post_dict["author"] = user.username
    post_dict["created_at"] = datetime.utcnow()
    post_dict["updated_at"] = datetime.utcnow()
    result = await db.posts.insert_one(post_dict)
    post_dict["id"] = str(result.inserted_id)
    return BlogPost(**post_dict)

@app.get("/posts", response_model=List[BlogPost])
async def get_posts():
    posts = await db.posts.find().to_list(100)
    for p in posts:
        p["id"] = str(p["_id"])
    return [BlogPost(**p) for p in posts]

@app.put("/posts/{post_id}", response_model=BlogPost)
async def update_post(post_id: str, post: BlogPost, user: UserInDB = Depends(get_current_active_user)):
    db_post = await db.posts.find_one({"_id": post_id})
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")
    if db_post["author"] != user.username and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    update_data = post.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    await db.posts.update_one({"_id": post_id}, {"$set": update_data})
    db_post.update(update_data)
    db_post["id"] = str(db_post["_id"])
    return BlogPost(**db_post)

@app.delete("/posts/{post_id}")
async def delete_post(post_id: str, user: UserInDB = Depends(get_current_active_user)):
    db_post = await db.posts.find_one({"_id": post_id})
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")
    if db_post["author"] != user.username and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    await db.posts.delete_one({"_id": post_id})
    return {"detail": "Post deleted"}

@app.post("/posts/{post_id}/comments", response_model=Comment)
async def add_comment(post_id: str, comment: CommentCreate, user: UserInDB = Depends(get_current_active_user)):
    comment_dict = {
        "post_id": post_id,
        "author": user.username,
        "content": comment.content,
        "created_at": datetime.utcnow()
    }
    result = await db.comments.insert_one(comment_dict)
    comment_dict["id"] = str(result.inserted_id)
    return Comment(**comment_dict)

@app.get("/posts/{post_id}/comments", response_model=List[Comment])
async def get_comments(post_id: str):
    comments = await db.comments.find({"post_id": post_id}).sort("created_at", 1).to_list(100)
    for c in comments:
        c["id"] = str(c["_id"])
    return [Comment(**c) for c in comments]
