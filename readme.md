# Attendance API

A Hono-based REST API for tracking class attendance with PostgreSQL database integration.

## Demo


https://github.com/user-attachments/assets/88b6ddc2-757b-41e5-91e7-63efa54cba0a



## Features

- Create and manage classes
- Import students via CSV upload
- Mark student attendance
- Retrieve present/absent student lists for specific dates
- Docker support for easy deployment

## Tech Stack

- [Hono](https://honojs.dev/) - Lightweight web framework
- [Prisma](https://www.prisma.io/) - ORM for database operations
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Docker](https://www.docker.com/) - Containerization

## Getting Started

### Prerequisites

- Node.js (v16+)
- Docker and Docker Compose
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone https://github.com/billa05/attendance-api.git
cd attendance-api
```

2. Install dependencies:

```bash
npm install
```

3. Start the PostgreSQL database using Docker:

```bash
docker-compose up -d
```

4. Set up the environment variables:

```bash
# .env file example
DATABASE_URL="postgresql://username:password@localhost:5432/attendance_db?schema=public"
PORT=3000
```

5. Initialize the database:

```bash
npx prisma migrate dev --name init
```

6. Start the server:

```bash
npm run dev
```

## API Documentation

### Create a New Class

Creates a new class in the system.

- **URL:** `/api/classes`
- **Method:** `POST`
- **Headers:** 
  - Content-Type: application/json
- **Body:**
```json
{
  "class_name": "CS101"
}
```
- **Success Response:**
```json
{
  "message": "Class created",
  "class_id": 1
}
```

### Import Users via CSV

Imports students from a CSV file into a specific class.

- **URL:** `/api/classes/{class_id}/import`
- **Method:** `POST`
- **Content-Type:** multipart/form-data
- **Body:** 
  - file: CSV file upload
    ```
    unique_number,name
    12345,John Doe
    67890,Jane Smith
    54321,Alice Brown
    ```
- **Success Response:**
```json
{
  "message": "Users imported",
  "total_users": 3
}
```

### Mark Attendance

Records a student's attendance for the current date.

- **URL:** `/api/classes/{class_id}/attendance`
- **Method:** `POST`
- **Headers:** 
  - Content-Type: application/json
- **Body:**
```json
{
  "unique_number": "12345"
}
```
- **Success Response:**
```json
{
  "message": "Attendance updated",
  "unique_number": "12345",
  "status": "Present"
}
```
- **Error Response (User Not Found):**
```json
{
  "message": "User not found",
  "unique_number": "12345"
}
```

### Fetch Present Members

Retrieves a list of students marked as present for a specific class and date.

- **URL:** `/api/classes/{class_id}/present`
- **Method:** `GET`
- **Query Parameters:**
  - date: Optional date in YYYY-MM-DD format (defaults to current date)
- **Success Response:**
```json
{
  "class_id": 1,
  "date": "2025-03-02",
  "present_students": [
    {
      "unique_number": "12345",
      "name": "John Doe"
    },
    {
      "unique_number": "67890",
      "name": "Jane Smith"
    }
  ]
}
```

### Fetch Absent Members

Retrieves a list of students marked as absent for a specific class and date.

- **URL:** `/api/classes/{class_id}/absent`
- **Method:** `GET`
- **Query Parameters:**
  - date: Optional date in YYYY-MM-DD format (defaults to current date)
- **Success Response:**
```json
{
  "class_id": 1,
  "date": "2025-03-02",
  "absent_students": [
    {
      "unique_number": "54321",
      "name": "Alice Brown"
    },
    {
      "unique_number": "98765",
      "name": "Bob Wilson"
    }
  ]
}
```
