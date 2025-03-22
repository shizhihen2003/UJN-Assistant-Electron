<template>
  <el-container class="app-container">
    <el-aside width="200px">
      <el-menu
          :router="true"
          default-active="/"
          class="el-menu-vertical"
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-menu-item>

        <el-sub-menu index="/lessons">
          <template #title>
            <el-icon><Calendar /></el-icon>
            <span>课表</span>
          </template>
          <el-menu-item index="/daily-lesson">当日课表</el-menu-item>
          <el-menu-item index="/term-lesson">学期课表</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="/eas">
          <template #title>
            <el-icon><School /></el-icon>
            <span>教务查询</span>
          </template>
          <el-menu-item index="/eas/notice">教务通知</el-menu-item>
          <el-menu-item index="/eas/lesson-table">课表查询</el-menu-item>
          <el-menu-item index="/eas/marks">成绩查询</el-menu-item>
          <el-menu-item index="/eas/academic">学业查询</el-menu-item>
          <el-menu-item index="/eas/exams">考试查询</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="/login">
          <template #title>
            <el-icon><User /></el-icon>
            <span>账号登录</span>
          </template>
          <el-menu-item index="/login/eas">教务登录</el-menu-item>
          <el-menu-item index="/login/ipass">智慧济大登录</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header>
        <div class="header-title">UJN-Assistant</div>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { HomeFilled, Calendar, School, User } from '@element-plus/icons-vue'
</script>

<style>
.app-container {
  height: 100vh;
}

.el-header {
  background-color: #409EFF;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
}

.header-title {
  font-size: 20px;
  font-weight: bold;
}

.el-aside {
  background-color: #f5f7fa;
  border-right: 1px solid #e6e6e6;
}

.el-menu-vertical {
  height: 100%;
  border-right: none;
}

.el-main {
  padding: 20px;
  background-color: #f5f7fa;
}
</style>