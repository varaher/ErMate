import { Request, Response, NextFunction } from "express";

export function requireHOD(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = (req as any).user || req.body?.user;

  if (!user) {
    const email = req.body?.email || req.body?.userEmail || (req as any).headers?.["x-user-email"];
    const isHOD =
      req.body?.isHOD === true ||
      email === "varahgrp@gmail.com" ||
      req.body?.role === "hod" ||
      req.body?.role === "consultant";

    if (isHOD) {
      (req as any).user = {
        uid: req.body?.uid || "uid_hod",
        email: email || "varahgrp@gmail.com",
        isHOD: true,
        role: req.body?.role || "hod"
      };
      return next();
    }

    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }

  const isHOD =
    user.isHOD === true ||
    user.email === "varahgrp@gmail.com" ||
    user.role === "hod" ||
    user.role === "consultant";

  if (!isHOD) {
    return res.status(403).json({
      success: false,
      error: "Access restricted to HOD and consultants",
    });
  }

  next();
}
