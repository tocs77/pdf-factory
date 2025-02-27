package migration

import (
	"pdfsrv/src/database"
	"pdfsrv/src/models"
)

func AutoMigrate() {
	if database.DB == nil {
		panic("DB is not initialized")
	}
	database.DB.AutoMigrate(models.File{})
}
