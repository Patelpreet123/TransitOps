# TransitOps

**Smart Transport Operations Platform**

TransitOps is a modern transport operations management system built for the Odoo Hackathon. It is designed to help organizations manage their fleet, drivers, trips, maintenance, fuel logs, operational expenses, and analytics from a single dashboard.

The project focuses primarily on the **Fleet Manager** experience, which is fully implemented and serves as the main working demo of the application. The other roles — **Driver**, **Safety Officer**, and **Financial Analyst** — are also present in the system and structured for role-based access, with partial dashboards and role-specific entry points.

---

## Key Highlights

* Secure email/password authentication
* Role-based access control (RBAC)
* Fleet Manager dashboard with structured transport workflows
* Vehicle registry with CRUD operations
* Driver management with profile and license tracking
* Trip management with validation and status tracking
* Maintenance tracking for vehicle service workflows
* Fuel tracking and expense management
* Reports and analytics with operational insights
* Responsive modern UI with a premium dark theme

---

## Main Demo Focus: Fleet Manager

The **Fleet Manager** role is the most complete and important workflow in TransitOps. It acts as the control center for fleet operations and demonstrates how the platform manages transport activity from end to end.

### What the Fleet Manager can do

#### 1. Dashboard Overview

The Fleet Manager dashboard provides a quick snapshot of daily operations, including:

* Active Vehicles
* Available Vehicles
* Vehicles in Maintenance
* Active Trips
* Pending Trips
* Drivers On Duty
* Fleet Utilization

This helps the fleet team understand the current operational status at a glance.

#### 2. Vehicle Registry

The Fleet Manager can add, update, search, filter, and manage vehicles in the fleet.

Each vehicle record includes:

* Registration Number
* Vehicle Name / Model
* Vehicle Type
* Maximum Load Capacity
* Odometer Reading
* Acquisition Cost
* Status

Vehicle statuses include:

* Available
* On Trip
* In Shop
* Retired

This module is useful for maintaining a centralized vehicle inventory and ensuring only eligible vehicles are assigned to trips.

#### 3. Driver Management

The Fleet Manager can create and manage driver profiles.

Each driver record includes:

* Full Name
* Email
* Phone Number
* License Number
* License Expiry Date
* Status
* Assigned Vehicle

This helps with driver tracking, compliance, and assignment planning.

Driver statuses include:

* Available
* On Trip
* Leave

#### 4. Trip Management

Trips can be created and managed from the Fleet Manager dashboard.

A trip typically includes:

* Vehicle
* Driver
* Source
* Destination
* Cargo Details
* Cargo Weight
* Distance
* Start Date
* End Date
* Status

Trip statuses include:

* Scheduled
* Active
* Completed
* Cancelled

Business rules help ensure that:

* a vehicle is not assigned to more than one active trip,
* a driver is not double-booked,
* retired or unavailable vehicles are excluded,
* cargo weight respects the selected vehicle’s load capacity.

#### 5. Maintenance

If a vehicle requires servicing, the Fleet Manager can create a maintenance record.

Maintenance tracking helps:

* mark vehicles as under service,
* prevent invalid dispatches,
* record service notes and dates,
* keep operational logs organized.

#### 6. Fuel Management

Fuel logs can be added for each vehicle to monitor consumption and cost.

This includes data such as:

* liters filled
* fuel cost
* date
* linked vehicle

Fuel tracking helps analyze running cost and efficiency.

#### 7. Expense Tracking

Fleet-related expenses such as tolls, maintenance costs, and other operational charges can be recorded in the expense module.

This gives a clearer picture of total fleet spending.

#### 8. Reports and Analytics

The Fleet Manager can view meaningful summaries and charts for:

* fleet utilization
* vehicle distribution
* trip activity
* maintenance trends
* fuel usage
* expense summaries
* operational insights

This module helps convert daily operational data into useful decision-making information.

---

## Other Roles

TransitOps also includes three other roles with role-based access:

### Driver

The Driver role is designed for operational use and provides access to driver-relevant dashboards and data views. It is structured to support driver-centered workflows and future enhancements.

### Safety Officer

The Safety Officer role is intended for compliance and safety-related responsibilities, such as monitoring driver validity and operational safety conditions.

### Financial Analyst

The Financial Analyst role is intended for reviewing fuel costs, maintenance expenses, operational spending, and profitability-related reports.

These roles are part of the RBAC structure and appear in the application, even though the Fleet Manager role is the most complete and polished demo flow.

---

## Technology Stack

### Frontend

* React 19
* TypeScript
* Vite
* React Router

### Backend

* Node.js
* Express
* TypeScript
* Prisma
* SQLite
* JWT Authentication

### UI / UX

* Premium dark theme
* Responsive layouts
* Modern cards and tables
* Clean navigation
* Smooth interactions
* Role-based dashboard experience

---

## Project Structure

```bash
TransitOps/
├── client/
│   ├── src/
│   ├── package.json
│   └── ...
├── server/
│   ├── src/
│   ├── prisma/
│   ├── package.json
│   └── ...
└── README.md
```

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd TransitOps
```

### 2. Install backend dependencies

```bash
cd server
npm install
```

### 3. Set up the database

```bash
npm run db:setup
```

### 4. Start the backend

```bash
npm run dev
```

### 5. Install frontend dependencies

Open a new terminal:

```bash
cd client
npm install
```

### 6. Start the frontend

```bash
npm run dev
```

### 7. Open the app

Visit:

```bash
http://localhost:5173
```

---

## Demo Flow

A recommended demo flow is:

1. Open the signup page
2. Create a Fleet Manager account
3. Log in
4. Show the Fleet Manager dashboard
5. Demonstrate Vehicle Registry
6. Demonstrate Driver Management
7. Demonstrate Trip Management
8. Show Maintenance, Fuel, and Expense sections
9. End with Reports and Analytics
10. Mention the additional roles and RBAC support

---

## Notes for Hackathon Reviewers

* The Fleet Manager workflow is the most complete and best-polished part of the system.
* The app uses role-based access control to separate responsibilities.
* The architecture is designed to support transport operations in a structured, scalable way.
* The UI focuses on clarity, responsiveness, and modern visual presentation.

---

## Future Improvements

Possible future enhancements include:

* Full role-specific workflows for Driver, Safety Officer, and Financial Analyst
* Email reminders for expiring licenses
* Document upload and storage
* PDF export for reports
* Advanced analytics and charting
* Activity logs and audit trails
* More detailed notifications

---

## License

This project was created for the Odoo Hackathon and is intended for demonstration and evaluation purposes.

---

## Acknowledgement

Built as a hackathon project focused on practical transport operations management, with a strong emphasis on the Fleet Manager workflow and a clean role-based user experience.
