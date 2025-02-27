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
	app := fiber.New()
	routes.SetupRoutes(app)
	app.Listen(":" + os.Getenv("APP_PORT"))
}
