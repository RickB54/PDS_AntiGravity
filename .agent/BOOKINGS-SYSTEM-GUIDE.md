# 📅 Bookings System Guide

## Overview
The new Bookings System provides a visual calendar interface for managing appointments. It is integrated with the "Book Now" page and allows admins to manually create, edit, and delete bookings.

## Features
- **Monthly Calendar View**: See all bookings at a glance.
- **Quick Add**: Click any day to add a booking for that date.
- **Edit/Delete**: Click any booking pill to view details, edit, or delete.
- **Customer Search**: Easily find existing customers when creating bookings.
- **Status Tracking**: Color-coded statuses (Pending, Confirmed, In Progress, Done).
- **Integration**: Syncs with the public "Book Now" page.

## How to Use

### Accessing the Calendar
1. Go to **Admin Dashboard**.
2. Look for the **"Tasks & Portal"** section.
3. Click **"Bookings Calendar"**.
4. Alternatively, use the **"Bookings"** link in the sidebar.

### Creating a Booking
1. Click on a **Day** in the calendar OR click the **"New Booking"** button.
2. Select a **Time**.
3. Search for a **Customer** (or type a new name).
4. Enter the **Service** (e.g., "Full Detail").
5. (Optional) Enter **Vehicle** and **Notes**.
6. Click **"Save Booking"**.

### Editing a Booking
1. Click on the booking pill in the calendar.
2. Modify the details in the modal.
3. Click **"Save Booking"**.

### Deleting a Booking
1. Click on the booking pill.
2. Click the **"Delete Booking"** button (red).
3. Confirm the deletion.

## Data Storage
Bookings are stored in `localStorage` (key: `bookings`). This ensures data persists across reloads and syncs between the public booking page and the admin calendar.
