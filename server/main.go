package main

import (
	"os"
	"pdfsrv/src/database"
	"pdfsrv/src/migration"
	"pdfsrv/src/routes"

	"github.com/gofiber/fiber/v2"
)

func main() {
	database.Connect()
	migration.AutoMigrate()
	app := fiber.New(fiber.Config{
		Prefork:   true,
		BodyLimit: 1024 * 1024 * 1000,
	})
	routes.SetupRoutes(app)
	app.Listen(":" + os.Getenv("APP_PORT"))
}
