"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Seeding database...');
    // Clean existing records
    await prisma.activityLog.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});
    const passwordHash = await bcryptjs_1.default.hash('Password123!', 10);
    // 1. Create Users
    const admin = await prisma.user.create({
        data: {
            name: 'System Administrator',
            email: 'admin@way2webs.com',
            password: passwordHash,
            role: 'ADMIN',
        },
    });
    const pm1 = await prisma.user.create({
        data: {
            name: 'Sarah Connor (PM)',
            email: 'pm@way2webs.com',
            password: passwordHash,
            role: 'PROJECT_MANAGER',
        },
    });
    const pm2 = await prisma.user.create({
        data: {
            name: 'David Miller (PM)',
            email: 'david.pm@way2webs.com',
            password: passwordHash,
            role: 'PROJECT_MANAGER',
        },
    });
    const member1 = await prisma.user.create({
        data: {
            name: 'Alice Johnson',
            email: 'alice@way2webs.com',
            password: passwordHash,
            role: 'TEAM_MEMBER',
        },
    });
    const member2 = await prisma.user.create({
        data: {
            name: 'Bob Smith',
            email: 'bob@way2webs.com',
            password: passwordHash,
            role: 'TEAM_MEMBER',
        },
    });
    const member3 = await prisma.user.create({
        data: {
            name: 'Charlie Brown',
            email: 'charlie@way2webs.com',
            password: passwordHash,
            role: 'TEAM_MEMBER',
        },
    });
    console.log('✅ Users created:');
    console.log('   Admin: admin@way2webs.com / Password123!');
    console.log('   PM: pm@way2webs.com / Password123!');
    console.log('   Member 1: alice@way2webs.com / Password123!');
    console.log('   Member 2: bob@way2webs.com / Password123!');
    // 2. Create Projects
    const project1 = await prisma.project.create({
        data: {
            name: 'E-Commerce Platform Redesign',
            description: 'Modernizing the checkout flow and revamping responsive user experience.',
            status: 'ACTIVE',
            startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            managerId: pm1.id,
            members: {
                create: [
                    { userId: member1.id },
                    { userId: member2.id },
                ],
            },
        },
    });
    const project2 = await prisma.project.create({
        data: {
            name: 'Mobile App API Gateway',
            description: 'Unified microservices API gateway for iOS and Android client applications.',
            status: 'ACTIVE',
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            managerId: pm1.id,
            members: {
                create: [
                    { userId: member2.id },
                    { userId: member3.id },
                ],
            },
        },
    });
    const project3 = await prisma.project.create({
        data: {
            name: 'Security Audit & Compliance 2026',
            description: 'Annual vulnerability assessment, dependency scanning, and RBAC verification.',
            status: 'PLANNING',
            startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            managerId: pm2.id,
            members: {
                create: [
                    { userId: member1.id },
                ],
            },
        },
    });
    console.log('✅ Sample projects created');
    // 3. Create Tasks
    const task1 = await prisma.task.create({
        data: {
            title: 'Design high-fidelity mockups for cart checkout',
            description: 'Create Figma prototypes including mobile and desktop responsive views.',
            status: 'DONE',
            priority: 'HIGH',
            dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            projectId: project1.id,
            assigneeId: member1.id,
            creatorId: pm1.id,
        },
    });
    const task2 = await prisma.task.create({
        data: {
            title: 'Integrate Stripe Payment Gateway',
            description: 'Implement payment intents and webhook listeners for order fulfillment.',
            status: 'IN_PROGRESS',
            priority: 'CRITICAL',
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            projectId: project1.id,
            assigneeId: member1.id,
            creatorId: pm1.id,
        },
    });
    const task3 = await prisma.task.create({
        data: {
            title: 'Implement Redis caching for product catalog',
            description: 'Reduce database load by caching frequently requested product categories.',
            status: 'TODO',
            priority: 'MEDIUM',
            dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
            projectId: project1.id,
            assigneeId: member2.id,
            creatorId: pm1.id,
        },
    });
    const task4 = await prisma.task.create({
        data: {
            title: 'Rate-limiting & Token bucket on Gateway',
            description: 'Prevent DDoS attacks by restricting API requests per API key / IP.',
            status: 'IN_REVIEW',
            priority: 'HIGH',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            projectId: project2.id,
            assigneeId: member2.id,
            creatorId: pm1.id,
        },
    });
    const task5 = await prisma.task.create({
        data: {
            title: 'Automate pen-testing script run in CI',
            description: 'Integrate OWASP ZAP automated scanner into the deployment pipeline.',
            status: 'TODO',
            priority: 'LOW',
            dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
            projectId: project3.id,
            assigneeId: member1.id,
            creatorId: pm2.id,
        },
    });
    console.log('✅ Sample tasks created');
    // 4. Create Comments
    await prisma.comment.create({
        data: {
            content: 'I have completed the Figma mocks and linked the prototype in Slack!',
            taskId: task1.id,
            authorId: member1.id,
        },
    });
    await prisma.comment.create({
        data: {
            content: 'Great work! Looks clean and ready for frontend implementation.',
            taskId: task1.id,
            authorId: pm1.id,
        },
    });
    await prisma.comment.create({
        data: {
            content: 'Webhook testing environment set up on staging. Ready for test charges.',
            taskId: task2.id,
            authorId: member1.id,
        },
    });
    // 5. Activity Logs
    await prisma.activityLog.createMany({
        data: [
            {
                userId: admin.id,
                action: 'SYSTEM_INITIALIZED',
                details: 'Initial database seed completed',
            },
            {
                userId: pm1.id,
                projectId: project1.id,
                action: 'PROJECT_CREATED',
                details: `Project "${project1.name}" created`,
            },
            {
                userId: pm1.id,
                projectId: project1.id,
                taskId: task1.id,
                action: 'TASK_STATUS_CHANGED',
                details: 'Task marked as DONE',
            },
        ],
    });
    console.log('✅ Activity logs & comments seeded');
}
main()
    .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
