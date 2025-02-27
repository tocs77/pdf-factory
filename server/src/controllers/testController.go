package controllers

import (
	"github.com/gofiber/fiber/v2"
)

func TestController(c *fiber.Ctx) error {
	return c.SendString("Hello, World!!! This is a test controller")
}
