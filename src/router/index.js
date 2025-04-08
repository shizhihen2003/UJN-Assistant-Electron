import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'

const routes = [
    {
        path: '/',
        name: 'Home',
        component: Home,
        meta: { title: '首页' }
    },
    {
        path: '/daily-lesson',
        name: 'DailyLesson',
        component: () => import('../views/DailyLesson.vue'),
        meta: { title: '当日课表' }
    },
    {
        path: '/term-lesson',
        name: 'TermLesson',
        component: () => import('../views/TermLesson.vue'),
        meta: { title: '学期课表' }
    },
    {
        path: '/ipass/school-calendar',
        name: 'SchoolCalendar',
        component: () => import('../views/IPass/Calendar.vue'),
        meta: { title: '校历查询' }
    },
    {
        path: '/login/eas',
        name: 'EASLogin',
        component: () => import('../views/Login/EASLogin.vue'),
        meta: { title: '教务登录' }
    },
    {
        path: '/login/ipass',
        name: 'IPassLogin',
        component: () => import('../views/Login/IPassLogin.vue'),
        meta: { title: '智慧济大登录' }
    },
    {
        path: '/eas/notice',
        name: 'Notice',
        component: () => import('../views/EAS/Notice.vue'),
        meta: { title: '教务通知' }
    },
    {
        path: '/eas/lesson-table',
        name: 'LessonTable',
        component: () => import('../views/EAS/LessonTable.vue'),
        meta: { title: '课表查询' }
    },
    {
        path: '/eas/marks',
        name: 'Marks',
        component: () => import('../views/EAS/Marks.vue'),
        meta: { title: '成绩查询' }
    },
    {
        path: '/eas/academic',
        name: 'Academic',
        component: () => import('../views/EAS/Academic.vue'),
        meta: { title: '学业查询' }
    },
    {
        path: '/eas/exams',
        name: 'Exams',
        component: () => import('../views/EAS/Exams.vue'),
        meta: { title: '考试查询' }
    },
    {
        path: '/eas/empty-classroom',
        name: 'Empty-classroom',
        component: () => import('../views/EAS/classroom.vue'),
        meta: { title: '空教室查询' }
    },
    {
        path: '/settings',
        name: 'Settings',
        component: () => import('../views/Settings.vue'),
        meta: { title: '设置' }
    }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

// 设置页面标题
router.beforeEach((to, from, next) => {
    document.title = to.meta.title ? `${to.meta.title} - UJN Assistant` : 'UJN Assistant'
    next()
})

export default router