const router = require("express").Router();
const prisma = require("../lib/prisma");
const multer = require("multer");
const { parse } = require("csv-parse/sync");

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/books
router.get("/", async (req, res, next) => {
  try {
    const books = await prisma.book.findMany({
      include: {
        publisher: true,
        inventory: true,
      },
      orderBy: { title: "asc" },
    });
    res.json({ success: true, data: books });
  } catch (err) {
    next(err);
  }
});

// POST /api/books/bulk-import
router.post("/bulk-import", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file)
      return res.json({ success: false, message: "No file uploaded" });

    const rows = parse(req.file.buffer.toString("utf8").replace(/^﻿/, ""), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const skipped = [];

    // 1. Validate all rows upfront
    const validRows = [];
    for (const row of rows) {
      const { title, publisher_name, cost_price, isbn, author, category, board, level } = row;
      if (!title || !publisher_name || !cost_price) {
        skipped.push({ row: title || "(untitled)", reason: "Missing required fields" });
        continue;
      }
      const parsedCost = parseFloat(cost_price);
      if (isNaN(parsedCost)) {
        skipped.push({ row: title, reason: "Invalid cost_price" });
        continue;
      }
      validRows.push({ title, publisher_name, cost_price: parsedCost, isbn: isbn || null, author: author || null, category: category || null, board: board || null, level: level || null });
    }

    // 2. Fetch existing ISBNs in one query to detect duplicates
    const incomingIsbns = validRows.map(r => r.isbn).filter(Boolean);
    const existingBooks = incomingIsbns.length
      ? await prisma.book.findMany({ where: { isbn: { in: incomingIsbns } }, select: { isbn: true } })
      : [];
    const existingIsbnSet = new Set(existingBooks.map(b => b.isbn));

    const toInsert = [];
    for (const row of validRows) {
      if (row.isbn && existingIsbnSet.has(row.isbn)) {
        skipped.push({ row: row.title, reason: `Duplicate ISBN: ${row.isbn}` });
        continue;
      }
      toInsert.push(row);
    }

    if (toInsert.length === 0) {
      return res.json({ success: true, data: { added: 0, skipped } });
    }

    // 3. Fetch all existing publishers in one query
    const publisherNames = [...new Set(toInsert.map(r => r.publisher_name.toLowerCase()))];
    const existingPublishers = await prisma.publisher.findMany({
      where: { name: { in: publisherNames, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    const publisherMap = new Map(existingPublishers.map(p => [p.name.toLowerCase(), p.id]));

    // 4. Create missing publishers in one batch
    const missingNames = [...new Set(
      toInsert
        .map(r => r.publisher_name)
        .filter(n => !publisherMap.has(n.toLowerCase()))
    )];
    if (missingNames.length) {
      await prisma.publisher.createMany({ data: missingNames.map(name => ({ name })), skipDuplicates: true });
      const newPublishers = await prisma.publisher.findMany({
        where: { name: { in: missingNames, mode: "insensitive" } },
        select: { id: true, name: true },
      });
      newPublishers.forEach(p => publisherMap.set(p.name.toLowerCase(), p.id));
    }

    // 5. Bulk insert all books
    await prisma.book.createMany({
      data: toInsert.map(r => ({
        title: r.title,
        isbn: r.isbn,
        author: r.author,
        category: r.category,
        board: r.board,
        level: r.level,
        mrp: r.cost_price,
        costPrice: r.cost_price,
        publisherId: publisherMap.get(r.publisher_name.toLowerCase()),
      })),
      skipDuplicates: true,
    });

    // 6. Bulk insert inventory records for newly created books
    const newBooks = await prisma.book.findMany({
      where: { title: { in: toInsert.map(r => r.title) } },
      select: { id: true },
    });
    const existingInventory = await prisma.inventory.findMany({
      where: { bookId: { in: newBooks.map(b => b.id) } },
      select: { bookId: true },
    });
    const existingInvSet = new Set(existingInventory.map(i => i.bookId));
    const inventoryToCreate = newBooks.filter(b => !existingInvSet.has(b.id)).map(b => ({ bookId: b.id, quantity: 0 }));
    if (inventoryToCreate.length) {
      await prisma.inventory.createMany({ data: inventoryToCreate, skipDuplicates: true });
    }

    res.json({ success: true, data: { added: toInsert.length - skipped.filter(s => s.reason?.startsWith('Duplicate')).length, skipped } });
  } catch (err) {
    next(err);
  }
});

// GET /api/books/:id
router.get("/:id", async (req, res, next) => {
  try {
    const book = await prisma.book.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { publisher: true, inventory: true },
    });
    if (!book)
      return res
        .status(404)
        .json({ success: false, message: "Book not found" });
    res.json({ success: true, data: book });
  } catch (err) {
    next(err);
  }
});

// POST /api/books
router.post("/", async (req, res, next) => {
  try {
    const {
      title,
      isbn,
      author,
      publisherId,
      category,
      board,
      level,
      costPrice,
    } = req.body;
    const book = await prisma.book.create({
      data: {
        title,
        isbn,
        author,
        publisherId: parseInt(publisherId),
        category,
        board: board || null,
        level: level || null,
        costPrice: parseFloat(costPrice),
        inventory: { create: { quantity: 0 } },
      },
      include: { publisher: true, inventory: true },
    });
    res.status(201).json({ success: true, data: book });
  } catch (err) {
    next(err);
  }
});

// PUT /api/books/:id
router.put("/:id", async (req, res, next) => {
  try {
    const {
      title,
      isbn,
      author,
      publisherId,
      category,
      board,
      level,
      costPrice,
    } = req.body;
    const book = await prisma.book.update({
      where: { id: parseInt(req.params.id) },
      data: {
        title,
        isbn,
        author,
        publisherId: publisherId ? parseInt(publisherId) : undefined,
        category,
        board: board !== undefined ? board || null : undefined,
        level: level !== undefined ? level || null : undefined,
        costPrice: costPrice ? parseFloat(costPrice) : undefined,
      },
      include: { publisher: true, inventory: true },
    });
    res.json({ success: true, data: book });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/books/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.inventory.deleteMany({ where: { bookId: id } });
    await prisma.book.delete({ where: { id } });
    res.json({ success: true, message: "Book deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
