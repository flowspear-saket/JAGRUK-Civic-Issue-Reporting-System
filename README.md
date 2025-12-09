# 🏙️ JAGRUK – Civic Issue Reporting System

> *Empowering citizens. Enabling transparency. Building smarter cities.*

---

## 🚀 Overview
**JAGRUK** (Jharkhand App for Grievance Reporting and User Knowledge) is a full-stack web platform designed to bridge the communication gap between **citizens and local authorities**.  
It enables users to **report civic issues** (like potholes, waste, broken lights, etc.), track their progress in real-time, and promote **community-driven governance**.

---

## ✨ Features

### 🧍 For Citizens
- 📍 **Location-based issue reporting** using an interactive map (Leaflet.js)
- 📸 Upload issue photos and detailed descriptions  
- 🔍 Search and view reports from nearby areas  
- 🔄 Real-time issue status tracking (Submitted → Acknowledged → In Progress → Resolved)
- 📢 Transparent and public issue visibility

### 🧑‍💼 For Administrators
- 🧾 **Admin Dashboard** for managing and prioritizing issues  
- 🚫 **Quarantine System** to filter duplicate or spam reports  
- 🔗 **Duplicate Issue Linking** for cleaner data and faster resolution  
- 📊 Generate reports with status summaries and analytics  
- ✅ JWT-based secure login & session management

---

## 🧠 Technical Overview

| Layer | Technology |
|-------|-------------|
| **Frontend** | React.js + Tailwind CSS |
| **Maps & Location** | Leaflet.js |
| **Backend** | Node.js + Express.js |
| **Database** | MongoDB (Atlas / local) |
| **Authentication** | JWT |
| **Deployment** | Frontend → Netlify<br>Backend → Render |
| **Storage** | Local uploads on backend *(migratable to Cloudinary / S3)* |

---

## ⚙️ Setup Instructions

### 🔧 Prerequisites
- Node.js (v16+)
- MongoDB or MongoDB Atlas account
- Git & npm/yarn

### 🛠️ Backend Setup
```bash
cd civicreport-backend
npm install
