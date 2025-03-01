// app.js
import { Hono } from 'hono';
import { serveStatic } from 'hono/serve-static';
import { cors } from 'hono/cors';
import { Database } from 'sqlite3';
import { PrismaClient } from '@prisma/client';
import { csvParse } from 'd3-dsv';
import { parseFile } from 'fast-csv';
import { createReadStream } from 'fs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { format } from 'date-fns';

// Initialize Hono app
const app = new Hono();

// Middleware
app.use('*', cors());

// Initialize Prisma client for database operations
const prisma = new PrismaClient();

// Routes
app.get('/', (c) => {
    return c.text('Attendance API is running');
});

// Create a new class
app.post('/api/classes', async (c) => {
    try {
        const body = await c.req.json();
        const { class_name } = body;

        if (!class_name) {
            return c.json({ error: 'Class name is required' }, 400);
        }

        const newClass = await prisma.class.create({
            data: {
                name: class_name
            }
        });

        return c.json({
            message: 'Class created',
            class_id: newClass.id
        }, 201);
    } catch (error) {
        console.error('Error creating class:', error);
        return c.json({ error: 'Failed to create class' }, 500);
    }
});

// Import users via CSV
app.post('/api/classes/:class_id/import', async (c) => {
    try {
        const classId = parseInt(c.req.param('class_id'));

        // Check if class exists
        const classExists = await prisma.class.findUnique({
            where: { id: classId }
        });

        if (!classExists) {
            return c.json({ error: 'Class not found' }, 404);
        }

        // Handle file upload
        const formData = await c.req.formData();
        const csvFile = formData.get('file');

        if (!csvFile || !(csvFile instanceof File)) {
            return c.json({ error: 'CSV file is required' }, 400);
        }

        // Read and process CSV file
        const csvContent = await csvFile.text();
        const rows = csvParse(csvContent);

        if (!rows.length) {
            return c.json({ error: 'CSV file is empty or invalid' }, 400);
        }

        // Extract unique numbers from CSV
        const uniqueNumbers = new Set();
        const studentsToCreate = [];

        for (const row of rows) {
            // Assuming CSV has columns: unique_number, name
            const uniqueNumber = row.unique_number?.trim();
            const name = row.name?.trim();

            if (uniqueNumber && name && !uniqueNumbers.has(uniqueNumber)) {
                uniqueNumbers.add(uniqueNumber);
                studentsToCreate.push({
                    uniqueNumber,
                    name,
                    classId
                });
            }
        }

        // Store in database
        await prisma.$transaction(
            studentsToCreate.map(student =>
                prisma.student.upsert({
                    where: {
                        uniqueNumber_classId: {
                            uniqueNumber: student.uniqueNumber,
                            classId
                        }
                    },
                    update: { name: student.name },
                    create: {
                        uniqueNumber: student.uniqueNumber,
                        name: student.name,
                        class: { connect: { id: classId } }
                    }
                })
            )
        );

        return c.json({
            message: 'Users imported',
            total_users: uniqueNumbers.size
        });
    } catch (error) {
        console.error('Error importing users:', error);
        return c.json({ error: 'Failed to import users' }, 500);
    }
});

// Mark attendance
app.post('/api/classes/:class_id/attendance', async (c) => {
    try {
        const classId = parseInt(c.req.param('class_id'));
        const body = await c.req.json();
        const { unique_number } = body;

        if (!unique_number) {
            return c.json({ error: 'Unique number is required' }, 400);
        }

        // Check if student exists in class
        const student = await prisma.student.findUnique({
            where: {
                uniqueNumber_classId: {
                    uniqueNumber: unique_number,
                    classId
                }
            }
        });

        if (!student) {
            return c.json({
                message: 'User not found',
                unique_number
            }, 404);
        }

        // Get current date (YYYY-MM-DD format)
        const today = format(new Date(), 'yyyy-MM-dd');

        // Update or create attendance record
        await prisma.attendance.upsert({
            where: {
                studentId_date: {
                    studentId: student.id,
                    date: today
                }
            },
            update: { status: 'Present' },
            create: {
                student: { connect: { id: student.id } },
                date: today,
                status: 'Present'
            }
        });

        return c.json({
            message: 'Attendance updated',
            unique_number,
            status: 'Present'
        });
    } catch (error) {
        console.error('Error marking attendance:', error);
        return c.json({ error: 'Failed to mark attendance' }, 500);
    }
});

// Fetch present members
app.get('/api/classes/:class_id/present', async (c) => {
    try {
        const classId = parseInt(c.req.param('class_id'));
        const dateParam = c.req.query('date');
        const date = dateParam || format(new Date(), 'yyyy-MM-dd');

        // Check if class exists
        const classExists = await prisma.class.findUnique({
            where: { id: classId }
        });

        if (!classExists) {
            return c.json({ error: 'Class not found' }, 404);
        }

        // Get present students
        const presentStudents = await prisma.student.findMany({
            where: {
                classId,
                attendances: {
                    some: {
                        date,
                        status: 'Present'
                    }
                }
            },
            select: {
                uniqueNumber: true,
                name: true
            }
        });

        return c.json({
            class_id: classId,
            date,
            present_students: presentStudents.map(student => ({
                unique_number: student.uniqueNumber,
                name: student.name
            }))
        });
    } catch (error) {
        console.error('Error fetching present members:', error);
        return c.json({ error: 'Failed to fetch present members' }, 500);
    }
});

// Fetch absent members
app.get('/api/classes/:class_id/absent', async (c) => {
    try {
        const classId = parseInt(c.req.param('class_id'));
        const dateParam = c.req.query('date');
        const date = dateParam || format(new Date(), 'yyyy-MM-dd');

        // Check if class exists
        const classExists = await prisma.class.findUnique({
            where: { id: classId }
        });

        if (!classExists) {
            return c.json({ error: 'Class not found' }, 404);
        }

        // Get absent students (all students minus present students)
        const absentStudents = await prisma.student.findMany({
            where: {
                classId,
                attendances: {
                    none: {
                        date,
                        status: 'Present'
                    }
                }
            },
            select: {
                uniqueNumber: true,
                name: true
            }
        });

        return c.json({
            class_id: classId,
            date,
            absent_students: absentStudents.map(student => ({
                unique_number: student.uniqueNumber,
                name: student.name
            }))
        });
    } catch (error) {
        console.error('Error fetching absent members:', error);
        return c.json({ error: 'Failed to fetch absent members' }, 500);
    }
});

// Start the server
const port = process.env.PORT || 3000;
console.log(`Server is running on port ${port}`);

export default {
    port,
    fetch: app.fetch
};