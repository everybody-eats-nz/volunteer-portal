# 🍽️ Everybody Eats Volunteer Portal

[![CI](https://github.com/everybody-eats-nz/volunteer-portal/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/everybody-eats-nz/volunteer-portal/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/everybody-eats-nz/volunteer-portal/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/everybody-eats-nz/volunteer-portal/actions/workflows/test.yml)
[![CodeQL](https://github.com/everybody-eats-nz/volunteer-portal/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main)](https://github.com/everybody-eats-nz/volunteer-portal/actions/workflows/github-code-scanning/codeql)

A comprehensive volunteer management system for [Everybody Eats](https://www.everybodyeats.nz), an innovative charitable restaurant that transforms rescued food into quality 3-course meals on a pay-what-you-can basis.

## 🚀 Project Overview

This volunteer portal streamlines the entire volunteer experience, from registration and onboarding to shift scheduling and recognition. The system helps coordinators manage volunteers efficiently while providing volunteers with an engaging, gamified experience.

### ✨ Key Features

- 🙋‍♀️ **Volunteer Registration & Onboarding**: Streamlined signup process with comprehensive profile management
- 📅 **Shift Management**: Easy browsing and signup for volunteer opportunities
- 🏆 **Achievement System**: Gamified volunteering with badges, milestones, and progress tracking
- 👥 **Admin Dashboard**: Complete volunteer oversight and shift management tools
- 📱 **Mobile-Responsive**: Works seamlessly on all devices
- 🔐 **Secure & Reliable**: Built with modern security practices and robust authentication

## 🏗️ Architecture

This project is organized as a monorepo:

### 🌐 `/web/` - Web Application

Next.js-based web application providing the admin dashboard, volunteer portal, and REST API backend.

**[📖 Web Documentation →](./web/README.md)**

### 📱 `/mobile/` - Mobile App

React Native/Expo companion app for volunteers — browse shifts, track achievements, connect with fellow volunteers, and get shift recaps on the go. Available on iOS and Android.

**[📖 Mobile App Documentation →](./mobile/README.md)**

### 📚 `/docs/` - Admin Documentation

Comprehensive administrator documentation built with Astro Starlight, providing detailed guides for managing volunteers, shifts, and restaurant operations.

**[📖 Admin Documentation →](./docs/README.md)** | **[🌐 Live Documentation Site →](https://docs.everybodyeats.nz)**
