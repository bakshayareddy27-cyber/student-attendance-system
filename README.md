# Student Attendance and Parent Notification System

A Full stack web-based attendance management system designed to help faculty record student attendance, maintain attendance history, and notify parents when a student is marked absent.

## About the Project

Keeping track of student attendance and informing parents about absences are important parts of academic management. When these tasks are handled manually, maintaining records and communicating updates can become time-consuming.

This project aims to make that process easier through a web application where faculty can mark attendance, attendance records are stored in MongoDB, and parents can be notified when their child is absent.

The project is being developed as part of our Web Programming lab activity. We are currently working on the implementation and integration of its different modules.

## Objectives

- Provide a simple interface for faculty to manage student attendance.
- Maintain student details, roll numbers, classes, and parent contact information.
- Store attendance records in MongoDB.
- Notify parents when a student is marked absent.
- Generate attendance reports and calculate attendance percentages.
- Prevent duplicate attendance records and handle notification failures safely.

## Features

The following features define the planned scope of the project. Their implementation and testing are still in progress.

### 1. Admin Module
- Add and manage student details.
- Assign roll numbers and classes.
- Maintain parent contact information.

### 2. Faculty Module
- Authenticate faculty users.
- Select a class and the relevant attendance session.
- Mark students as present or absent.

### 3. Attendance Management
- Save attendance records to MongoDB.
- Maintain attendance history by student and date.
- Display daily attendance records.
- Prevent duplicate records for the same student and class session.

### 4. Parent Notifications
- Trigger a notification when a student is marked absent.
- Include relevant details such as the student's name, roll number, and date.
- Track notification status and record delivery failures.
- Avoid duplicate notifications and support safe retries.

Email notifications using Nodemailer are one of the planned approaches. The final notification method and its configuration will depend on the implementation.

### 5. Reports
- View attendance history.
- Calculate attendance percentages.
- Search attendance records by student or date.

## Application Workflow

1. Faculty logs in to the application.
2. Faculty selects a class and attendance session.
3. Attendance is marked as Present or Absent.
4. The attendance record is saved to MongoDB.
5. If a student is marked absent, the system initiates a parent notification.
6. The system records the notification status.
7. Faculty can view attendance records and reports.

Notifications should be triggered only after attendance has been saved successfully.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript, Bootstrap |
| Backend | Node.js, Express.js |
| Database | MongoDB |
| Database integration | Mongoose |
| Email notifications | Nodemailer |
| Development environment | Visual Studio Code |
| Database management | MongoDB Compass |
| Version control | Git and GitHub |

## Database Design

The application is planned around the following MongoDB collections.

| Collection | Purpose |
|---|---|
| `students` | Stores student details, roll numbers, class information, and parent contacts. |
| `users` | Stores user details, password hashes, and roles. |
| `attendance` | Stores attendance status, date, student reference, faculty reference, and notification status. |
| `notifications` | Stores notification messages, recipient details, timestamps, and delivery status. |

The database design will support attendance tracking and notification management while helping prevent duplicate records.

## Project Structure

The current project contains the following main directories and files:

```text
attendance-system/
├── config/        # Configuration and database setup
├── jobs/          # Background jobs
├── middleware/    # Request middleware
├── models/        # Database models
├── notifiers/     # Notification-related code
├── public/        # Frontend assets and pages
├── routes/        # Application routes
├── seed/          # Demo data setup
├── services/      # Application services
├── tests/         # Tests
├── utils/         # Utility functions
├── app.js         # Express application setup
├── server.js      # Server entry point
├── package.json   # Dependencies and scripts
├── .env.example   # Environment configuration template
├── .gitignore     # Files excluded from Git
└── README.md      # Project documentation
```

## Getting Started

### Prerequisites

Install the following before running the application:

- [Node.js](https://nodejs.org/)
- npm, included with Node.js
- [MongoDB Community Server](https://www.mongodb.com/try/download/community) or a MongoDB Atlas database
- [Visual Studio Code](https://code.visualstudio.com/)

### Installation

**1. Clone the repository**

```bash
git clone <your-github-repository-url>
```

**2. Navigate to the project directory**

```bash
cd attendance-system
```

**3. Install dependencies**

```bash
npm install
```

**4. Configure environment variables**

Create a `.env` file using `.env.example` as the template. Configure the MongoDB connection and any other required settings.

Do not commit `.env` or expose database credentials, email passwords, or API keys.

**5. Start the application**

Use the start command defined in `package.json`:

```bash
npm start
```

Make sure MongoDB is running and the environment configuration is valid before starting the application.

If the project uses additional setup or seed commands, follow the instructions in the project configuration and documentation.

## Current Development Status

**Status: In Progress**

The project structure and initial application code are available. Development is ongoing, and the modules need to be integrated and verified against the lab requirements.

The remaining work includes validating the complete attendance workflow, testing database operations, confirming parent notification delivery, checking duplicate prevention, and verifying the reporting features.

The application should be considered complete only after these workflows have been tested successfully.

## Team

This project is being developed collaboratively as part of our Web Programming lab activity.

- **B. Sonuraj** — 24R21A6671
- **N. Siri Chandana** — 24R21A66A7
- **B. Nikitha** — 24R21A6670
- **B. Akshaya** — 24R21A6672

## Academic Context

This project is part of a lab activity focused on web application development, backend integration, database operations, attendance management, and automated parent notifications.

The goal is to build a functional application that demonstrates these concepts through a practical use case.

---
