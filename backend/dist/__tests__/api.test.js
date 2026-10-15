"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../app"));
const db_1 = __importDefault(require("../config/db"));
describe('Project & Team Management System API Tests', () => {
    let adminToken;
    let pmToken;
    let memberToken;
    let createdProjectId;
    let createdTaskId;
    let memberUserId;
    beforeAll(async () => {
        // 1. Authenticate Admin
        const adminRes = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
            email: 'admin@way2webs.com',
            password: 'Password123!',
        });
        expect(adminRes.status).toBe(200);
        adminToken = adminRes.body.data.token;
        // 2. Authenticate Project Manager
        const pmRes = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
            email: 'pm@way2webs.com',
            password: 'Password123!',
        });
        expect(pmRes.status).toBe(200);
        pmToken = pmRes.body.data.token;
        // 3. Authenticate Team Member
        const memberRes = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
            email: 'alice@way2webs.com',
            password: 'Password123!',
        });
        expect(memberRes.status).toBe(200);
        memberToken = memberRes.body.data.token;
        memberUserId = memberRes.body.data.user.id;
    });
    afterAll(async () => {
        await db_1.default.$disconnect();
    });
    describe('1. Authentication & Security Tests', () => {
        it('should reject login with invalid password', async () => {
            const res = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send({
                email: 'admin@way2webs.com',
                password: 'WrongPassword!',
            });
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
        it('should reject register with invalid email format', async () => {
            const res = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                name: 'Test User',
                email: 'not-an-email',
                password: 'Password123!',
            });
            expect(res.status).toBe(422);
            expect(res.body.success).toBe(false);
        });
        it('should register a new user successfully', async () => {
            const uniqueEmail = `newuser_${Date.now()}@example.com`;
            const res = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send({
                name: 'New Tester',
                email: uniqueEmail,
                password: 'SecurePassword123!',
                role: 'TEAM_MEMBER',
            });
            expect(res.status).toBe(201);
            expect(res.body.data.user.email).toBe(uniqueEmail);
            expect(res.body.data.token).toBeDefined();
        });
        it('should get current authenticated user profile', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.user.role).toBe('ADMIN');
        });
        it('should reject protected route without auth token', async () => {
            const res = await (0, supertest_1.default)(app_1.default).get('/api/projects');
            expect(res.status).toBe(401);
        });
    });
    describe('2. Project Lifecycle & Authorization Tests', () => {
        it('Team Member cannot create projects (403 Forbidden)', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/projects')
                .set('Authorization', `Bearer ${memberToken}`)
                .send({
                name: 'Unauthorized Project',
                description: 'Should fail',
            });
            expect(res.status).toBe(403);
        });
        it('Project Manager can create a project', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/projects')
                .set('Authorization', `Bearer ${pmToken}`)
                .send({
                name: 'Super Secret PM Project',
                description: 'Created by PM for testing',
                status: 'ACTIVE',
                memberIds: [memberUserId],
            });
            expect(res.status).toBe(201);
            expect(res.body.data.name).toBe('Super Secret PM Project');
            createdProjectId = res.body.data.id;
        });
        it('Project Manager can update project details', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .patch(`/api/projects/${createdProjectId}`)
                .set('Authorization', `Bearer ${pmToken}`)
                .send({
                description: 'Updated description by PM',
                status: 'ON_HOLD',
            });
            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('ON_HOLD');
        });
    });
    describe('3. Task Management & Validation Tests', () => {
        it('fails to create a task when title is missing', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${pmToken}`)
                .send({
                projectId: createdProjectId,
            });
            expect(res.status).toBe(422);
        });
        it('Project Manager can create a task and assign to team member', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${pmToken}`)
                .send({
                title: 'Implement OAuth Login Flow',
                description: 'Support Google and GitHub OAuth 2.0',
                projectId: createdProjectId,
                assigneeId: memberUserId,
                priority: 'HIGH',
                status: 'TODO',
                dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
            });
            expect(res.status).toBe(201);
            expect(res.body.data.title).toBe('Implement OAuth Login Flow');
            createdTaskId = res.body.data.id;
        });
        it('Team Member can update status of their assigned task', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .patch(`/api/tasks/${createdTaskId}`)
                .set('Authorization', `Bearer ${memberToken}`)
                .send({
                status: 'IN_PROGRESS',
            });
            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('IN_PROGRESS');
        });
        it('Team Member cannot modify task title/priority (Forbidden)', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .patch(`/api/tasks/${createdTaskId}`)
                .set('Authorization', `Bearer ${memberToken}`)
                .send({
                title: 'Hacked Title',
                priority: 'LOW',
            });
            expect(res.status).toBe(403);
        });
        it('allows users to post comments on accessible tasks', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`/api/tasks/${createdTaskId}/comments`)
                .set('Authorization', `Bearer ${memberToken}`)
                .send({
                content: 'Started working on the authorization code grant flow.',
            });
            expect(res.status).toBe(201);
            expect(res.body.data.content).toBe('Started working on the authorization code grant flow.');
        });
        it('filters and paginates tasks correctly', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`/api/tasks?projectId=${createdProjectId}&status=IN_PROGRESS&page=1&limit=5`)
                .set('Authorization', `Bearer ${pmToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
            expect(res.body.pagination).toBeDefined();
            expect(res.body.pagination.page).toBe(1);
        });
    });
    describe('4. Dashboard & Reporting Metrics Tests', () => {
        it('returns calculated metrics for Admin', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get('/api/dashboard/summary')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.projects).toBeDefined();
            expect(res.body.data.tasks).toBeDefined();
            expect(res.body.data.tasks.byStatus).toBeDefined();
            expect(typeof res.body.data.tasks.total).toBe('number');
        });
    });
    describe('5. Clean up & Cascading Deletion Tests', () => {
        it('Project Manager can delete their project', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .delete(`/api/projects/${createdProjectId}`)
                .set('Authorization', `Bearer ${pmToken}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            // Verify task and project no longer exist
            const taskCheck = await (0, supertest_1.default)(app_1.default)
                .get(`/api/tasks/${createdTaskId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(taskCheck.status).toBe(404);
        });
    });
});
