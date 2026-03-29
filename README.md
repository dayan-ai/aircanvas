# 🎨 AIR CANVAS

Air Canvas is an interactive, browser-based web application that lets you draw on your screen using just your hands! This project is powered by cutting-edge computer vision using Mediapipe and modern web technologies to give you a smooth, magical drawing experience. 

Built automatically using GLM-5, this codebase represents a fully functioning full-stack application.

---

## ✨ Features
- **Real-time AI Hand Tracking**: Leverages `@mediapipe/hands` for responsive and accurate finger tracking.
- **Draw Without Touching**: Paint and draw through the webcam with smooth and natural gestures.
- **Modern Full-Stack Architecture**: Powered by **Next.js 14+** (App Router).
- **Beautiful UI**: Designed with **Tailwind CSS** and **Shadcn UI** components.
- **Database Ready**: Includes a pre-configured **Prisma** setup with SQLite for storing user data or post metadata.

---

## 🚀 Getting Started

Follow these instructions to set up the project locally on your machine.

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed along with `npm` or [Bun](https://bun.sh/).

### Installation

1. Clone this repository (or download it directly):
   ```bash
   git clone https://github.com/dayan-ai/aircanvas.git
   cd aircanvas
   ```

2. Install the dependencies:
   ```bash
   npm install
   # or
   bun install
   ```

3. Setup your environment variables:
   Create a `.env` file in the root of your project and configure your local database URL:
   ```env
   DATABASE_URL="file:./dev.db"
   ```

4. Initialize the Prisma database setup:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

### Running the App

Start the Next.js development server:
```bash
npm run dev
# or 
bun run dev
```
Navigate to [http://localhost:3000](http://localhost:3000) to start drawing!

---

## 🛠️ Tech Stack
- **Framework**: Next.js (React)
- **Styling**: Tailwind CSS & Framer Motion
- **UI Components**: Radix UI / Shadcn
- **AI / Computer Vision**: Mediapipe (Camera & Drawing Utils)
- **Database**: Prisma ORM with SQLite
- **Authentication**: NextAuth.js

---

## 📝 License
This project is open-sourced and available for personal or educational use.
