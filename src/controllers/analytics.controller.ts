// ============================================
// ComES Backend - Analytics Controller
// ============================================

import { Request, Response, NextFunction } from 'express';
import { Visitor } from '../models/analytics.model';
import { asyncHandler } from '../utils';

/**
 * @desc    Track a new visit
 * @route   POST /api/v1/analytics/visit
 * @access  Public
 */
export const trackVisit = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const {
      sessionId,
      path,
      title,
      userAgent,
      screenResolution,
      language,
      referrer,
      device,
      browser,
      os,
      timestamp,
    } = req.body;

    // Check if session exists
    let visitor = await Visitor.findOne({ sessionId });

    if (visitor) {
      // Returning visitor
      visitor.isReturning = true;
      visitor.pageViews.push({
        path,
        title,
        timestamp: new Date(timestamp),
        duration: 0,
      });
      await visitor.save();
    } else {
      // New visitor
      visitor = await Visitor.create({
        sessionId,
        visitedAt: new Date(timestamp),
        pageViews: [{
          path,
          title,
          timestamp: new Date(timestamp),
          duration: 0,
        }],
        userAgent,
        screenResolution,
        language,
        referrer: referrer || 'direct',
        device,
        browser,
        os,
        isReturning: false,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Visit tracked',
    });
  }
);

/**
 * @desc    Track a page view
 * @route   POST /api/v1/analytics/pageview
 * @access  Public
 */
export const trackPageView = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { sessionId, previousPath, previousDuration, path, title, timestamp } = req.body;

    const visitor = await Visitor.findOne({ sessionId });

    if (visitor) {
      // Update previous page duration
      const lastPageView = visitor.pageViews.find((pv) => pv.path === previousPath);
      if (lastPageView) {
        lastPageView.duration = previousDuration;
      }

      // Add new page view
      visitor.pageViews.push({
        path,
        title,
        timestamp: new Date(timestamp),
        duration: 0,
      });

      // Update total duration
      visitor.duration = visitor.pageViews.reduce((sum, pv) => sum + pv.duration, 0);

      await visitor.save();
    }

    res.status(200).json({
      success: true,
      message: 'Page view tracked',
    });
  }
);

/**
 * @desc    Get analytics summary
 * @route   GET /api/v1/analytics/summary
 * @access  Private (Admin)
 */
export const getAnalyticsSummary = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: Record<string, unknown> = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate as string);
    }

    const matchStage: Record<string, unknown> = {};
    if (Object.keys(dateFilter).length > 0) {
      matchStage.visitedAt = dateFilter;
    }

    // Get total counts
    const [
      totalVisitors,
      uniqueVisitors,
      returningVisitors,
      totalPageViews,
      avgDuration,
    ] = await Promise.all([
      Visitor.countDocuments(matchStage),
      Visitor.countDocuments({ ...matchStage, isReturning: false }),
      Visitor.countDocuments({ ...matchStage, isReturning: true }),
      Visitor.aggregate([
        { $match: matchStage },
        { $project: { pageViewCount: { $size: '$pageViews' } } },
        { $group: { _id: null, total: { $sum: '$pageViewCount' } } },
      ]),
      Visitor.aggregate([
        { $match: matchStage },
        { $group: { _id: null, avg: { $avg: '$duration' } } },
      ]),
    ]);

    // Get device breakdown
    const deviceBreakdown = await Visitor.aggregate([
      { $match: matchStage },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Get browser breakdown
    const browserBreakdown = await Visitor.aggregate([
      { $match: matchStage },
      { $group: { _id: '$browser', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Get top pages
    const topPages = await Visitor.aggregate([
      { $match: matchStage },
      { $unwind: '$pageViews' },
      { $group: { _id: { path: '$pageViews.path', title: '$pageViews.title' }, views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, path: '$_id.path', title: '$_id.title', views: 1 } },
    ]);

    // Get top referrers
    const topReferrers = await Visitor.aggregate([
      { $match: matchStage },
      { $group: { _id: '$referrer', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, source: '$_id', count: 1 } },
    ]);

    // Get visits by date (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const visitsByDate = await Visitor.aggregate([
      { $match: { visitedAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$visitedAt' } },
          visitors: { $sum: 1 },
          pageViews: { $sum: { $size: '$pageViews' } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', visitors: 1, pageViews: 1 } },
    ]);

    // Get visits by hour
    const visitsByHour = await Visitor.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $hour: '$visitedAt' },
          visitors: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, hour: '$_id', visitors: 1 } },
    ]);

    // Get recent visitors
    const recentVisitors = await Visitor.find(matchStage)
      .sort('-visitedAt')
      .limit(10);

    // Calculate totals
    const total = totalVisitors || 1; // Avoid division by zero
    const pageViewsTotal = totalPageViews[0]?.total || 0;

    // Calculate bounce rate (visitors with only 1 page view)
    const singlePageVisitors = await Visitor.countDocuments({
      ...matchStage,
      $expr: { $eq: [{ $size: '$pageViews' }, 1] },
    });
    const bounceRate = (singlePageVisitors / total) * 100;

    const summary = {
      totalVisitors,
      totalPageViews: pageViewsTotal,
      uniqueVisitors,
      averageSessionDuration: avgDuration[0]?.avg || 0,
      bounceRate: Math.round(bounceRate * 10) / 10,
      returningVisitors,
      newVisitors: uniqueVisitors,
      topPages,
      topReferrers,
      deviceBreakdown: deviceBreakdown.map((d) => ({
        device: d._id || 'Unknown',
        count: d.count,
        percentage: Math.round((d.count / total) * 100),
      })),
      browserBreakdown: browserBreakdown.map((b) => ({
        browser: b._id || 'Unknown',
        count: b.count,
        percentage: Math.round((b.count / total) * 100),
      })),
      visitsByDate,
      visitsByHour,
      recentVisitors,
    };

    res.status(200).json(summary);
  }
);

/**
 * @desc    Get visitors list
 * @route   GET /api/v1/analytics/visitors
 * @access  Private (Admin)
 */
export const getVisitors = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: Record<string, unknown> = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate as string);
    }

    const matchStage: Record<string, unknown> = {};
    if (Object.keys(dateFilter).length > 0) {
      matchStage.visitedAt = dateFilter;
    }

    const [visitors, total] = await Promise.all([
      Visitor.find(matchStage).sort('-visitedAt').skip(skip).limit(limit),
      Visitor.countDocuments(matchStage),
    ]);

    res.status(200).json({
      visitors,
      total,
    });
  }
);
